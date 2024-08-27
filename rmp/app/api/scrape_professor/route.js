import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

export async function POST(req) {
  const { url } = await req.json();

  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    const profName = $('div.NameTitle__Name-dowf0z-0.cfjPUG').text().trim();
    const profSubject = $('a.TeacherDepartment__StyledDepartmentLink-fl79e8-0').text().trim();
    const profRating = $('div.RatingValue__Numerator-qw8sqy-2').text().trim();

    const allReviews = $('div.Comments__StyledComments-dzzyvm-0.gRjWel')
      .map((_, el) => $(el).text().trim())
      .get();

    const reviews = allReviews.slice(0, Math.min(5, allReviews.length));

    const openai = new OpenAI();
    const pc = new Pinecone({apiKey: process.env.PINECONE_API_KEY});
    const index = pc.index('ai-rate-my-professor').namespace('ns1');

    // Summarize the reviews
    const reviewSummaryResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that summarizes student reviews of professors."
        },
        {
          role: "user",
          content: `Please summarize these ${reviews.length} reviews of Professor ${profName} in about 2-3 sentences: ${reviews.join(' ')}`
        }
      ],
    });

    const reviewSummary = reviewSummaryResponse.choices[0].message.content;

    const professorData = [{
      name: profName,
      department: profSubject,
      rating: profRating,
      reviewSummary: reviewSummary
    }];

    // Batch processing
    const batchSize = 20; // Adjust based on your Pinecone plan limits
    for (let i = 0; i < professorData.length; i += batchSize) {
      const batch = professorData.slice(i, i + batchSize);
      const vectors = await Promise.all(batch.map(async (prof) => {
        const text = `${profName} is a professor in the ${profSubject} department with an overall quality rating of ${profRating}. Here is a summary of student reviews: ${reviewSummary}`;
        
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
          encoding_format: 'float',
        });

        return {
          id: `${prof.name}`,
          values: embedding.data[0].embedding,
          metadata: {
              department: prof.department,
              rating: prof.rating,
              numRatings: prof.numRatings,
              reviewSummary: prof.reviewSummary,
          },
        };
      }));

      await index.upsert(vectors);
    }

    return NextResponse.json({
      success: true,
      message: `**Professor:** ${profName}\n**Department:** ${profSubject}\n**Rating:** ${profRating}\n**Review Summary:** ${reviewSummary}`,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, message: 'Failed to scrape and store data' }, { status: 500 });
  }
}
