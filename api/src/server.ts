import Fastify from 'fastify'
import cors from '@fastify/cors'
import { handleMessage } from './agent'
import 'dotenv/config'

async function main() {
  const app = Fastify({ logger: false })
  await app.register(cors, { origin: true })

  app.get('/health', async () => ({ ok: true }))

  app.post('/api/chat', async (req) => {
    const { clientId, text } = req.body as { clientId: string; text: string }
    return await handleMessage({ clientId, text, channel: 'simulator' })
  })

  await app.listen({ port: 3000, host: '0.0.0.0' })
  console.log('API sur http://localhost:3000')
}

main().catch((e) => { console.error(e); process.exit(1) })