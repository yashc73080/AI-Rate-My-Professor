# NOT BEING USED IN THE PROJECT

from dotenv import load_dotenv
load_dotenv(dotenv_path='../.env.local')
from pinecone import Pinecone, ServerlessSpec
from openai import OpenAI
import os
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time
import click

# Initialize Pinecone
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

# Create a Pinecone index
pc_index_names = [index.name for index in pc.list_indexes()]
if "ai-rate-my-professor" not in pc_index_names:
    pc.create_index(
        name="ai-rate-my-professor",
        dimension=1536,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1"),
    )

# Initialize OpenAI client
client = OpenAI()

def scrape_professors(school_id, max_professors=1000):
    url = f"https://www.ratemyprofessors.com/search/professors/{school_id}?q=*"
    professors = []
    
    # Set up Selenium WebDriver (make sure to have the appropriate driver installed)
    driver = webdriver.Chrome()  
    driver.get(url)
    
    try:
        while len(professors) < max_professors:
            # Wait for the professor cards to load
            WebDriverWait(driver, 10).until(
                EC.presence_of_all_elements_located((By.CSS_SELECTOR, '.TeacherCard__StyledTeacherCard-syjs0d-0'))
            )
            
            # Extract professor data
            cards = driver.find_elements(By.CSS_SELECTOR, '.TeacherCard__StyledTeacherCard-syjs0d-0')
            
            for card in cards:
                if len(professors) >= max_professors:
                    break
                
                name = card.find_element(By.CSS_SELECTOR, '.CardName__StyledCardName-sc-1gyrgim-0').text.strip()
                department = card.find_element(By.CSS_SELECTOR, '.CardSchool__Department-sc-19lmz2k-0').text.strip()
                rating = card.find_element(By.CSS_SELECTOR, '.CardNumRating__CardNumRatingNumber-sc-17t4b9u-2').text.strip()
                num_ratings = card.find_element(By.CSS_SELECTOR, '.CardNumRating__CardNumRatingCount-sc-17t4b9u-3').text.strip()
                
                feedback_numbers = card.find_elements(By.CSS_SELECTOR, '.CardFeedback__CardFeedbackNumber-lq6nix-2')
                would_take_again = feedback_numbers[0].text.strip() if len(feedback_numbers) > 0 else 'N/A'
                difficulty = feedback_numbers[1].text.strip() if len(feedback_numbers) > 1 else 'N/A'
                
                professors.append({
                    'name': name,
                    'department': department,
                    'rating': rating,
                    'num_ratings': num_ratings,
                    'would_take_again': would_take_again,
                    'difficulty': difficulty
                })
            
            print(f"Scraped {len(professors)} professors so far...")
            
            try:
                # Try to click the "Show More" button
                show_more_button = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, 'button.Buttons__Button-sc-19xdot-1.PaginationButton__StyledPaginationButton-txi1dr-1'))
                )
                if show_more_button.is_enabled() and show_more_button.text.strip() == 'Show More':
                    show_more_button.click()
                    time.sleep(2)  # Wait for new content to load
                else:
                    print("No more results to load.")
                    break
            except TimeoutException:
                print("Couldn't find 'Show More' button. All results may have been loaded.")
                break
    
    finally:
        driver.quit()
    
    return professors

# Scrape professor data
school_id = 824  # Replace with the correct school ID
scraped_data = scrape_professors(school_id)

processed_data = []

# Create embeddings for each professor
for professor in scraped_data:
    review_text = f"Professor {professor['name']} in {professor['department']} has a rating of {professor['rating']} based on {professor['num_ratings']} ratings. {professor['would_take_again']}% would take again. Difficulty: {professor['difficulty']}/5."
    
    response = client.embeddings.create(
        input=review_text, model="text-embedding-3-small"
    )
    embedding = response.data[0].embedding
    
    processed_data.append({
        "values": embedding,
        "id": professor["name"],
        "metadata": {
            "name": professor["name"],
            "department": professor["department"],
            "rating": professor["rating"],
            "num_ratings": professor["num_ratings"],
            "would_take_again": professor["would_take_again"],
            "difficulty": professor["difficulty"],
            "review": review_text
        }
    })

# Insert the embeddings into the Pinecone index
index = pc.Index("ai-rate-my-professor")
upsert_response = index.upsert(
    vectors=processed_data,
    namespace="ns1",
)
print(f"Upserted count: {upsert_response['upserted_count']}")

# Print index statistics
print(index.describe_index_stats())