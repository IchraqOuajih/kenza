import { db } from '../../db/client'
import { relanceQueue } from '../../jobs/queue'

const DELAI_DEFAUT = Number(process.env.RELANCE_DELAY_MINUTES ?? 2)

/**
 * L'agent décide lui-même de relancer : il enregistre le panier
 * et planifie la tâche. Rien n'est envoyé maintenant.
 */
export async function planifierRelance(
  conversationId: string,
  clientId: string,
  lignes: { ref: string; quantite: number }[],
  raison: string,
  delaiMinutes = DELAI_DEFAUT
) {
  const { rows } = await db.query(
    `INSERT INTO paniers (conversation_id, client_id, lignes, statut)
     VALUES ($1, $2, $3, 'ouvert') RETURNING id`,
    [conversationId, clientId, JSON.stringify(lignes)]
  )
  const panierId = rows[0].id

  await relanceQueue.add(
    'relance',
    { panierId, conversationId, clientId, lignes, raison },
    { delay: delaiMinutes * 60_000, removeOnComplete: true }
  )

  return {
    relance_planifiee: true,
    panier_id: panierId,
    dans_minutes: delaiMinutes,
    raison,
  }
}