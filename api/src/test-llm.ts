import OpenAI from 'openai'
import 'dotenv/config'

const client = new OpenAI({
  baseURL: process.env.LLM_URL,
  apiKey: process.env.LLM_API_KEY,
})

async function main() {
  const r = await client.chat.completions.create({
    model: process.env.LLM_MODEL!,
    messages: [{ role: 'user', content: 'Réponds juste: OK' }],
  })
  console.log('Réponse :', r.choices[0].message.content)
}

main().catch(console.error)