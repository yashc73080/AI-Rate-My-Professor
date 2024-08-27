// NO LONGER BEING USED

// import dotenv from 'dotenv';
// dotenv.config({ path: '.env.local' });

import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import puppeteer from 'puppeteer';

export async function scrapeProfessors(url, maxRetries = 3) {
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  let retries = 0;
  while (retries < maxRetries) {
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 60000 // 60 seconds timeout
      });
      break;
    } catch (error) {
      console.error(`Navigation failed (attempt ${retries + 1}):`, error.message);
      if (retries === maxRetries - 1) {
        await browser.close();
        throw new Error('Max retries reached. Unable to load the page.');
      }
      retries++;
      await delay(5000);
    }
  }

  // Extract the total number of professors from the page header
  const totalProfessors = await page.evaluate(() => {
    const headerText = document.querySelector('[data-testid="pagination-header-main-results"]')?.textContent;
    if (headerText) {
      const match = headerText.match(/(\d+)\s+professors/);
      return match ? parseInt(match[1], 10) : null;
    }
    return null;
  });

  if (!totalProfessors) {
    console.error('Unable to determine the total number of professors.');
    await browser.close();
    return [];
  }

  console.log(`Target number of professors: ${totalProfessors}`);

  let professors = new Map();
  let noNewProfessorsCount = 0;
  const maxNoNewProfessors = 5; // Allow up to 5 iterations without new professors before stopping

  while (professors.size < totalProfessors) {
    try {
      await page.waitForSelector('.TeacherCard__StyledTeacherCard-syjs0d-0', { timeout: 10000 });

      const newProfessors = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.TeacherCard__StyledTeacherCard-syjs0d-0')).map(card => {
          const getTextContent = (selector) => {
            const element = card.querySelector(selector);
            return element ? element.textContent.trim().normalize('NFKD') : 'N/A';
          };

          return {
            name: getTextContent('.CardName__StyledCardName-sc-1gyrgim-0'),
            department: getTextContent('.CardSchool__Department-sc-19lmz2k-0'),
            rating: getTextContent('.CardNumRating__CardNumRatingNumber-sc-17t4b9u-2'),
            numRatings: getTextContent('.CardNumRating__CardNumRatingCount-sc-17t4b9u-3'),
            wouldTakeAgain: getTextContent('.CardFeedback__CardFeedbackNumber-lq6nix-2'),
            difficulty: getTextContent('.CardFeedback__CardFeedbackNumber-lq6nix-2:nth-child(2)'), //TODO add school name and change prompt to only answer based on school name
          };
        });
      });

      const previousSize = professors.size;
      newProfessors.forEach(prof => professors.set(prof.name, prof));

      console.log(`Number of unique professors: ${professors.size} / ${totalProfessors}`);

      if (professors.size === previousSize) {
        noNewProfessorsCount++;
        if (noNewProfessorsCount >= maxNoNewProfessors) {
          console.log(`No new professors added for ${maxNoNewProfessors} iterations. Ending scraping.`);
          break;
        }
      } else {
        noNewProfessorsCount = 0;
      }

      const hasNextPage = await page.evaluate(() => {
        const nextButton = document.querySelector('button.Buttons__Button-sc-19xdot-1.PaginationButton__StyledPaginationButton-txi1dr-1');
        if (nextButton && nextButton.textContent.trim() === 'Show More' && !nextButton.disabled) {
          nextButton.click();
          return true;
        }
        return false;
      });

      if (!hasNextPage) {
        console.log("No 'Show More' button found or it's disabled. Ending scraping.");
        break;
      }

      await delay(2000);
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
    } catch (error) {
      console.error('An error occurred during scraping:', error);
      break;
    }
  }

  await browser.close();
  return Array.from(professors.values());
}

export async function storeProfessorsInPinecone(professors) {
  const openai = new OpenAI();
  const pc = new Pinecone({apiKey: process.env.PINECONE_API_KEY});
  const index = pc.index('ai-rate-my-professor').namespace('ns1');

  for (const prof of professors) {
    const text = `${prof.name} is a professor in the ${prof.department} department with an overall quality rating of ${prof.rating}. They have ${prof.numRatings} ratings, a ${prof.wouldTakeAgain} would take again rating, and a difficulty rating of ${prof.difficulty}.`.normalize('NFKD');
    
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
    await storeProfessorsInPinecone(professors);
    console.log(`Stored ${professors.length} professors in Pinecone.`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

main().catch(console.error);