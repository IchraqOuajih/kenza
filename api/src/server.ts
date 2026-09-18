import Fastify from 'fastify'
import cors from '@fastify/cors'
import { handleMessage } from './agent'
import { dashboardRoutes } from './routes/dashboard'
import { db } from './db/client'
import 'dotenv/config'

async function main() {
  const app = Fastify({ logger: false })
  await app.register(cors, { origin: true })

  app.get('/health', async () => ({ ok: true }))

  app.post('/api/chat', async (req) => {
    const { clientId, text } = req.body as { clientId: string; text: string }
    return await handleMessage({ clientId, text, channel: 'simulator' })
  })

  app.get('/api/messages', async (req) => {
    const { clientId } = req.query as { clientId: string }
    const { rows } = await db.query(
      `SELECT m.role, m.contenu, m.created_at
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.client_id = $1
       ORDER BY m.created_at ASC`,
      [clientId]
    )
    return rows
  })

  await app.register(dashboardRoutes)

  await app.listen({ port: 3000, host: '0.0.0.0' })
  console.log('API sur http://localhost:3000')
}

main().catch((e) => { console.error(e); process.exit(1) })