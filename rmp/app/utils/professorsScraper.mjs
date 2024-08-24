import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import puppeteer from 'puppeteer';

export async function scrapeProfessors(url) {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });

  let professors = [];
  let hasNextPage = true;

  while (hasNextPage) {
    await page.waitForSelector('.TeacherCard__StyledTeacherCard-syjs0d-0', { timeout: 10000 });

    const newProfessors = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.TeacherCard__StyledTeacherCard-syjs0d-0')).map(card => {
        const getTextContent = (selector) => {
          const element = card.querySelector(selector);
          return element ? element.textContent.trim() : 'N/A';
        };

        return {
          name: getTextContent('.CardName__StyledCardName-sc-1gyrgim-0'),
          department: getTextContent('.CardSchool__Department-sc-19lmz2k-0'),
          rating: getTextContent('.CardNumRating__CardNumRatingNumber-sc-17t4b9u-2'),
          numRatings: getTextContent('.CardNumRating__CardNumRatingCount-sc-17t4b9u-3'),
          wouldTakeAgain: getTextContent('.CardFeedback__CardFeedbackNumber-lq6nix-2'),
          difficulty: getTextContent('.CardFeedback__CardFeedbackNumber-lq6nix-2:nth-child(2)'), //TODO not being read correctly
        };
      });
    });

    professors = professors.concat(newProfessors);

    hasNextPage = await page.evaluate(() => {
      const nextButton = document.querySelector('button[aria-label="Show More"]');
      if (nextButton && !nextButton.disabled) {
        nextButton.click();
        return true;
      }
      return false;
    });

    if (hasNextPage) {
      await page.waitForTimeout(2000);
    }
  }

  await browser.close();
  return professors;
}

export async function storeProfessorsInPinecone(professors) {
  const openai = new OpenAI();
  const pc = new Pinecone({apiKey: process.env.PINECONE_API_KEY});
  const index = pc.index('ai-rate-my-professor').namespace('ns1');

  for (const prof of professors) {
    const text = `${prof.name} is a professor in the ${prof.department} department with an overall quality rating of ${prof.rating}. They have ${prof.numRatings} ratings, a ${prof.wouldTakeAgain} would take again rating, and a difficulty rating of ${prof.difficulty}.`;
    
    try {
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      });

      await index.upsert([{
        id: prof.name,
        values: embedding.data[0].embedding,
        metadata: {
          department: prof.department,
          rating: prof.rating,
          numRatings: prof.numRatings,
          wouldTakeAgain: prof.wouldTakeAgain,
          difficulty: prof.difficulty,
        },
      }]);
    } catch (error) {
      console.error(`Error processing professor ${prof.name}:`, error);
    }
  }
}

async function main() {
  const url = 'https://www.ratemyprofessors.com/search/professors/824?q=*';
  try {
    const professors = await scrapeProfessors(url);
    console.log(`Scraped ${professors.length} professors.`);
    console.log(professors);
    await storeProfessorsInPinecone(professors);
    console.log(`Stored ${professors.length} professors in Pinecone.`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

main().catch(console.error);