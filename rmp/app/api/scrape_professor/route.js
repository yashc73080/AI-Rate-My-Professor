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
    // TODO add info about reviews, summarize?

    const openai = new OpenAI();
    const text = `${profName} is a professor in the ${profSubject} department with an overall quality rating of ${profRating}.`;
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });

    const pc = new Pinecone({apiKey: process.env.PINECONE_API_KEY});
    const index = pc.index('ai-rate-my-professor').namespace('ns1');
    await index.upsert([{
      id: profName,
      values: embedding.data[0].embedding,
      metadata: {
        subject: profSubject,
        stars: profRating,
      },
    }]);

    return NextResponse.json({
      success: true,
      message: `Found information about ${profName} in the ${profSubject} department with an overall quality rating of ${profRating}`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: 'Failed to scrape and store data' }, { status: 500 });
  }
}