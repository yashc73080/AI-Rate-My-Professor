import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

function normalizeString(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export async function scrapeProfessors(url, maxRetries = 3, limit = Infinity) {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    let retries = 0;
    while (retries < maxRetries) {
      try {
        await page.goto(url, { 
          waitUntil: 'networkidle0',
          timeout: 2000000 // 2000 seconds timeout
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

    if (limit === Infinity) {
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

          limit = totalProfessors;
    }
  
    let professors = new Map();
    let noNewProfessorsCount = 0;
    const maxNoNewProfessors = 5; // Allow up to 5 iterations without new professors before stopping
  
    while (professors.size < limit) {
      try {
        await page.waitForSelector('.TeacherCard__StyledTeacherCard-syjs0d-0', { timeout: 30000 });
  
        const newProfessors = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.TeacherCard__StyledTeacherCard-syjs0d-0')).map(card => {

            const getTextContent = (selector, index = 0) => {
                const elements = card.querySelectorAll(selector);
                return elements[index] ? elements[index].textContent.trim() : 'N/A';
            };

            const getFeedbackValue = (labelText) => {
                const feedbackItems = card.querySelectorAll('.CardFeedback__CardFeedbackItem-lq6nix-1');
                for (const item of feedbackItems) {
                  if (item.textContent.toLowerCase().includes(labelText.toLowerCase())) {
                    const numberElement = item.querySelector('.CardFeedback__CardFeedbackNumber-lq6nix-2');
                    return numberElement ? numberElement.textContent.trim() : 'N/A';
                  }
                }
                return 'N/A';
            };
              
              return {
                name: getTextContent('.CardName__StyledCardName-sc-1gyrgim-0'),
                department: getTextContent('.CardSchool__Department-sc-19lmz2k-0'),
                school: getTextContent('.CardSchool__School-sc-19lmz2k-1'),
                rating: getTextContent('.CardNumRating__CardNumRatingNumber-sc-17t4b9u-2'),
                numRatings: getTextContent('.CardNumRating__CardNumRatingCount-sc-17t4b9u-3'),
                // wouldTakeAgain: getFeedbackValue('would take again'),
                difficulty: getFeedbackValue('level of difficulty'),
              };
          });
        });

        const previousSize = professors.size;
        for (const prof of newProfessors) {
          if (professors.size >= limit) break;
          const normalizedProf = Object.fromEntries(
            Object.entries(prof).map(([key, value]) => [key, normalizeString(value)])
          );
          professors.set(normalizedProf.name, normalizedProf);
        }
  
        console.log(`Number of unique professors: ${professors.size} / ${limit}`);
  
        if (professors.size >= limit) {
          console.log(`Reached the specified limit of ${limit} professors. Stopping scraping.`);
          break;
        }
  
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

    const professorsArray = Array.from(professors.values());
    // console.log(professorsArray);
  
    if (professorsArray.length === 0) {
        throw new Error('No professors were scraped');
    }

    const schoolName = professorsArray[0]?.school;
    if (!schoolName) {
        throw new Error('Unable to determine school name from scraped data');
    }
    //   console.log(schoolName);

    return {
        schoolName: schoolName.replace(/\s+/g, '_'),
        professors: professorsArray
    };
}

async function storeProfessorsAsJson(professors) {
    if (professors.length === 0) {
      console.log('No professors to store.');
      return;
    }
  
    const schoolName = professors[0].school.replace(/\s+/g, '_');
    const fileName = `professors_${schoolName}.json`;
    const dirPath = 'professors';
    const filePath = path.join(dirPath, fileName);
  
    try {
      await fs.mkdir(dirPath, { recursive: true });
      const jsonData = JSON.stringify(professors, null, 2);
      await fs.writeFile(filePath, jsonData);
      console.log(`Stored ${professors.length} professors in ${filePath}`);
      return schoolName; // Return the school name for later use
    } catch (error) {
      console.error('Error storing professors data:', error);
      return null;
    }
  }
  
async function uploadProfessorsToPinecone(schoolName) {
  const openai = new OpenAI();
  const pc = new Pinecone({apiKey: process.env.PINECONE_API_KEY});
  const index = pc.index('ai-rate-my-professor').namespace('ns1');

  const fileName = `professors_${schoolName}.json`;
  const filePath = path.join('professors', fileName);

  try {
    const jsonData = await fs.readFile(filePath, 'utf-8');
    const professors = JSON.parse(jsonData);

    const batchSize = 20; // Adjust based on your Pinecone plan limits
    for (let i = 0; i < professors.length; i += batchSize) {
      const batch = professors.slice(i, i + batchSize);
      const vectors = await Promise.all(batch.map(async (prof) => {
        const text = `${prof.name} is a professor in the ${prof.department} department of ${prof.school} with an overall quality rating of ${prof.rating}. They have ${prof.numRatings} ratings and a difficulty rating of ${prof.difficulty}.`;
        
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
          encoding_format: 'float',
        });

        return {
          id: `${schoolName}_${prof.name}`, // Include school name in ID to ensure uniqueness
          values: embedding.data[0].embedding,
          metadata: {
              school: prof.school,
              department: prof.department,
              rating: prof.rating,
              numRatings: prof.numRatings,
              difficulty: prof.difficulty,
          },
        };
      }));

      await index.upsert(vectors);
      console.log(`Uploaded batch ${i/batchSize + 1} of ${fileName} to Pinecone`);
    }

    // Wait for a short time to allow Pinecone to update its stats
    console.log("Waiting for Pinecone to update stats...");
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay

    // Check stats with retries
    let stats;
    let retries = 0;
    const maxRetries = 3;
    while (retries < maxRetries) {
      stats = await index.describeIndexStats();
      if (stats.totalRecordCount > 0) {
        break;
      }
      console.log(`Attempt ${retries + 1}: Stats not updated yet. Waiting...`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between retries
      retries++;
    }

    console.log('Pinecone index stats:', stats);
    if (stats.totalRecordCount === 0) {
      console.log('Warning: Pinecone stats still show 0 records. Check the Pinecone console for the most up-to-date information.');
    }
  } catch (error) {
    console.error(`Error processing ${fileName}:`, error);
  }
}

async function testWithLimitedProfessors(limit = 10) {
    const url = 'https://www.ratemyprofessors.com/search/professors/824?q=*';
    try {
      const { schoolName, professors } = await scrapeProfessors(url, 3, limit);
      console.log(`Scraped ${professors.length} professors from ${schoolName}.`);
      
      await storeProfessorsAsJson(professors);
      
      await uploadProfessorsToPinecone(schoolName);
      console.log(`Test completed with professors from ${schoolName} uploaded to Pinecone.`);
    } catch (error) {
      console.error('An error occurred during testing:', error);
    }
}
  

async function main() {
    const url = 'https://www.ratemyprofessors.com/search/professors/824?q=*';
  
    // Test run with limited professors
    // await testWithLimitedProfessors(5); // Change this number to set the limit
  
    // Full run (uncomment when ready for full scraping)
    try {
      const { schoolName, professors } = await scrapeProfessors(url);
      console.log(`Scraped ${professors.length} professors from ${schoolName}.`);
      
      await storeProfessorsAsJson(professors);
      
      await uploadProfessorsToPinecone(schoolName);
      console.log(`Professors data for ${schoolName} uploaded to Pinecone.`);
    } catch (error) {
      console.error('An error occurred:', error);
    }
  }

main().catch(console.error);