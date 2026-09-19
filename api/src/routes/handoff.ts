import type { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { sauverMessage, rendreLaMain } from '../db/conversations'

export async function handoffRoutes(app: FastifyInstance) {
  /** Le commerçant répond au client et rend la main à l'agent. */
  app.post('/api/escalades/:id/repondre', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { texte } = req.body as { texte: string }

    if (!texte?.trim()) return reply.code(400).send({ erreur: 'texte vide' })

    const { rows } = await db.query(
      `SELECT conversation_id FROM escalades WHERE id = $1 AND statut = 'ouverte'`,
      [id]
    )
    if (!rows[0]) return reply.code(404).send({ erreur: 'escalade introuvable ou déjà traitée' })

    const conversationId = rows[0].conversation_id

    await sauverMessage(conversationId, 'commercant', texte.trim())
    await db.query(`UPDATE escalades SET statut = 'resolue' WHERE id = $1`, [id])
    await rendreLaMain(conversationId)

    return { ok: true, conversation_id: conversationId }
  })

  /** Rendre la main sans répondre. */
  app.post('/api/escalades/:id/ignorer', async (req) => {
    const { id } = req.params as { id: string }
    const { rows } = await db.query(
      `UPDATE escalades SET statut = 'resolue' WHERE id = $1 RETURNING conversation_id`,
      [id]
    )
    if (rows[0]) await rendreLaMain(rows[0].conversation_id)
    return { ok: true }
  })
}