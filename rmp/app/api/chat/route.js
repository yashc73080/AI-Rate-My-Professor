import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import OpenAI from 'openai'

const systemPrompt = `
You are a rate my professor agent to help students find classes, that takes in user questions and answers them.
Only answer based on the university/school chosen by the user. Do not give information about professors from other universities/schools.
The user may provide a link to a professor's page on ratemyprofessor.com. Use scraped information from that page to answer more specific questions about that professor.
Show information about each professor on a new line. 

Examples:

User query: Who are the best professors in the Computer Science department?
Agent response:
Here are some good science professors at Rutgers based on their ratings and difficulty:
1. Professor 1 
   - Rating: 4.5
   - Difficulty: 3.5

2. Professor 2
    - Rating: 4.0
    - Difficulty: 3.0
`

export async function POST(req) {
    const data = await req.json()
    
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    })
    const index = pc.index('ai-rate-my-professor').namespace('ns1')
    const openai = new OpenAI()

    const text = data[data.length - 1].content
    const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
    })

    const results = await index.query({
        topK: 3, // How many results we want
        includeMetadata: true,
        vector: embedding.data[0].embedding,
    })

    let resultString = ''
    results.matches.forEach((match) => {
        resultString += `
        Returned Results:
        Professor: ${match.id}
        Department: ${match.metadata.department}
        Rating: ${match.metadata.rating}
        Difficulty: ${match.metadata.difficulty}
        \n\n`
    })

    const lastMessage = data[data.length - 1]
    const lastMessageContent = lastMessage.content + resultString
    const lastDataWithoutLastMessage = data.slice(0, data.length - 1)

    const completion = await openai.chat.completions.create({
        messages: [
            {role: 'system', content: systemPrompt},
            ...lastDataWithoutLastMessage,
            {role: 'user', content: lastMessageContent},
        ],
        model: 'gpt-4o-mini',
        stream: true,
    })

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder()
            try {
                for await (const chunk of completion) {
                    let content = chunk.choices[0]?.delta?.content
                    if (content) {
                        content = content.replace(/\*\*(.*?)\*\*/g, '$1')
                        const text = encoder.encode(content)
                        controller.enqueue(text)
                    }
                }  
            } catch (err) {
                controller.error(err)
            } finally {
                controller.close()
            }
        },
    })
    return new NextResponse(stream)
}