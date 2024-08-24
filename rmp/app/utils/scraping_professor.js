// Scrapes one professor page from RateMyProfessors and stores the information in Pinecone

'use client';

export async function scrapeData(url) {
  try {
    const response = await fetch('../api/scrape_professor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error('Failed to scrape and store data');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    throw new Error('Failed to scrape and store data');
  }
}