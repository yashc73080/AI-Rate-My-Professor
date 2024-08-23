from dotenv import load_dotenv
load_dotenv(dotenv_path='../.env.local')
from pinecone import Pinecone, ServerlessSpec
from openai import OpenAI
import os
import json

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

# Load the review data
data = json.load(open("reviews.json"))

processed_data = []
client = OpenAI()

# Create embeddings for each review
for review in data["reviews"]:
    response = client.embeddings.create(
        input=review['review'], model="text-embedding-3-small"
    )
    embedding = response.data[0].embedding
    processed_data.append(
        {
            "values": embedding,
            "id": review["professor"],
            "metadata":{
                "review": review["review"],
                "subject": review["subject"],
                "stars": review["stars"],
            }
        }
    )

# Insert the embeddings into the Pinecone index
index = pc.Index("ai-rate-my-professor")
upsert_response = index.upsert(
    vectors=processed_data,
    namespace="ns1",
)
print(f"Upserted count: {upsert_response['upserted_count']}")

# Print index statistics
print(index.describe_index_stats())