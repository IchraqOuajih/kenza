import OpenAI, { AzureOpenAI } from 'openai'
import 'dotenv/config'


const reasoning = new OpenAI({
  baseURL: process.env.LLM_URL,
  apiKey: process.env.LLM_API_KEY,
})


const fast = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
})

export function getModel(kind: 'fast' | 'reasoning') {
  return kind === 'reasoning'
    ? { client: reasoning, model: process.env.LLM_MODEL! }
    : { client: fast, model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME! }
}