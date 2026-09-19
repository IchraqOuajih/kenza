import Fastify from 'fastify'
import cors from '@fastify/cors'
import { handleMessage } from './agent'
import { bufferiser } from './agent/buffer'
import { dashboardRoutes } from './routes/dashboard'
import { handoffRoutes } from './routes/handoff'
import { db } from './db/client'
import 'dotenv/config'

async function main() {
  // Une image en base64 dépasse la limite de corps par défaut de Fastify.
  const app = Fastify({ logger: false, bodyLimit: 8 * 1024 * 1024 })
  await app.register(cors, { origin: true })

  app.get('/health', async () => ({ ok: true }))

  app.post('/api/chat', async (req) => {
    const { clientId, text, image } = req.body as
      { clientId: string; text?: string; image?: string }

    // Une photo est un geste unique et délibéré : pas de regroupement,
    // on la traite immédiatement.
    if (image) {
      return await handleMessage({
        clientId, text: text ?? '', channel: 'simulator', image,
      })
    }

    return await bufferiser(clientId, text ?? '', (complet, nb) =>
      handleMessage({ clientId, text: complet, channel: 'simulator', groupes: nb })
    )
  })

  app.get('/api/messages', async (req) => {
    const { clientId } = req.query as { clientId: string }

    const { rows: conv } = await db.query(
      `SELECT id, statut FROM conversations
       WHERE client_id = $1 AND statut IN ('ouverte','escalade')
       ORDER BY updated_at DESC LIMIT 1`,
      [clientId]
    )
    if (!conv[0]) return { statut: 'ouverte', messages: [] }

    const { rows } = await db.query(
      `SELECT role, contenu, created_at FROM messages
       WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conv[0].id]
    )
    return { statut: conv[0].statut, messages: rows }
  })

  await app.register(dashboardRoutes)
  await app.register(handoffRoutes)

  await app.listen({ port: 3000, host: '0.0.0.0' })
  console.log('API sur http://localhost:3000')
}

main().catch((e) => { console.error(e); process.exit(1) })