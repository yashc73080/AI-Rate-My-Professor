import { NextResponse } from 'next/server';
import { scrapeProfessors, storeProfessorsInPinecone } from '../../utils/professorsScraper';

export async function POST(req) {
  const { url } = await req.json();

  try {
    const professors = await scrapeProfessors(url);
    await storeProfessorsInPinecone(professors);

    return NextResponse.json({
      success: true,
      message: `Successfully scraped and stored data for ${professors.length} professors.`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: 'Failed to scrape and store data' }, { status: 500 });
  }
}