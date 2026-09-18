import { db } from './client'

export async function getOrCreateConversation(clientId: string, canal: string): Promise<string> {
  const { rows } = await db.query(
    `SELECT id FROM conversations WHERE client_id = $1 AND statut = 'ouverte'
     ORDER BY updated_at DESC LIMIT 1`,
    [clientId]
  )
  if (rows[0]) return rows[0].id

  const { rows: cree } = await db.query(
    `INSERT INTO conversations (client_id, canal) VALUES ($1, $2) RETURNING id`,
    [clientId, canal]
  )
  return cree[0].id
}

/** Les N derniers messages, pour que l'agent se souvienne. */
export async function chargerHistorique(conversationId: string, limit = 20) {
  const { rows } = await db.query(
    `SELECT role, contenu FROM (
       SELECT role, contenu, created_at FROM messages
       WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2
     ) t ORDER BY created_at ASC`,
    [conversationId, limit]
  )
  return rows.map(r => ({
    role: r.role === 'client' ? 'user' : 'assistant',
    content: r.contenu,
  }))
}

export async function sauverMessage(conversationId: string, role: 'client' | 'agent', contenu: string) {
  await db.query(
    `INSERT INTO messages (conversation_id, role, contenu) VALUES ($1, $2, $3)`,
    [conversationId, role, contenu]
  )
  await db.query(`UPDATE conversations SET updated_at = now() WHERE id = $1`, [conversationId])
}

export async function sauverTraces(conversationId: string, traces: any[]) {
  for (const t of traces) {
    await db.query(
      `INSERT INTO traces (conversation_id, etape, outil, entree, sortie, decision)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [conversationId, t.etape, t.outil ?? null,
       t.entree ? JSON.stringify(t.entree) : null,
       t.sortie ? JSON.stringify(t.sortie) : null,
       t.decision]
    )
  }
}

export async function sauverEscalade(conversationId: string, motif: string, resume: string) {
  const { rows } = await db.query(
    `INSERT INTO escalades (conversation_id, motif, contexte)
     VALUES ($1, $2, $3) RETURNING id`,
    [conversationId, motif, JSON.stringify({ resume })]
  )
  return rows[0].id
}