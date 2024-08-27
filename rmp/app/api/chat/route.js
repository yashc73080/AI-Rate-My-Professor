import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import OpenAI from 'openai'

const getSystemPrompt = (selectedSchool) => `
You are a rate my professor agent to help students find classes at ${selectedSchool}, that takes in user questions and answers them. Only give information about professors if asked for, don't give it for no reason. 
Only answer based on ${selectedSchool}. Do not give information about professors from other universities/schools.
The user may provide a link to a professor's page on ratemyprofessor.com. Use scraped information from that page to answer more specific questions about that professor.
Show information about each professor on a new line. If there is no relevant information available, clearly state that you do not have the required data.

When listing professors, use the following format:
1. Professor Name
   - Department: [Department]
   - Rating: [Rating]
   - Difficulty: [Difficulty]

Ensure to use proper line breaks in your response.

Examples:

User query: Who are the best professors in the Computer Science department?
Agent response:
Here are some good computer science professors at ${selectedSchool} based on their ratings and difficulty:

1. Professor 1
   - Department: Computer Science
   - Rating: 4.5
   - Difficulty: 3.5

2. Professor 2
   - Department: Computer Science
   - Rating: 4.0
   - Difficulty: 3.0

If no professors match the query:
Agent response:
Sorry, I do not have enough information to answer your question about professors at ${selectedSchool}.
`

export async function POST(req) {
    const { messages, selectedSchool } = await req.json()
    console.log(selectedSchool)
    
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    })
    const index = pc.index('ai-rate-my-professor').namespace('ns1')
    const openai = new OpenAI()

    const text = messages[messages.length - 1].content
    const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
    })

    const results = await index.query({
        topK: 3,
        includeMetadata: true,
        vector: embedding.data[0].embedding,
        // filter: { school: selectedSchool }
    })

    let queryString = ''
    if (results.matches.length > 0) {
        queryString = 'Returned Results:\n\n'
        results.matches.forEach((match, index) => {
            queryString += `${index + 1}. ${match.id}
   - Department: ${match.metadata.department}
   - Rating: ${match.metadata.rating}
   - Difficulty: ${match.metadata.difficulty}
\n\n`
        })
    } else {
        queryString = `Sorry, I do not have enough information to answer your question about professors at ${selectedSchool}.`
    }

    const completionMessages = [
        { role: 'system', content: getSystemPrompt(selectedSchool) },
        ...messages,
    ]

    if (queryString) {
        completionMessages.push({
            role: 'system',
            content: `The following information was retrieved from the database:\n\n${queryString}`,
        })
    }

    const completion = await openai.chat.completions.create({
        messages: completionMessages,
        model: 'gpt-4o-mini',
        stream: true,
    })

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder()
            try {
                for await (const chunk of completion) {
                    const content = chunk.choices[0]?.delta?.content
                    if (content) {
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