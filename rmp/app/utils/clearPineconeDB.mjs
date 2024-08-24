// run with node app/utils/clearPineconeDB.mjs

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Pinecone } from '@pinecone-database/pinecone'

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
const index = pc.index("ai-rate-my-professor")

await index.namespace('ns1').deleteAll();