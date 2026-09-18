import crypto from 'node:crypto'
import { connection } from '../jobs/queue'

const TTL = Number(process.env.CACHE_TTL_SECONDS ?? 180)

const normaliser = (t: string) => t.toLowerCase().trim().replace(/\s+/g, ' ')

const cle = (conversationId: string, texte: string) =>
  'rep:' + conversationId + ':' +
  crypto.createHash('sha1').update(normaliser(texte)).digest('hex')

export async function reponseEnCache(conversationId: string, texte: string): Promise<string | null> {
  try { return await connection.get(cle(conversationId, texte)) } catch { return null }
}

export async function mettreEnCache(conversationId: string, texte: string, reponse: string) {
  try { await connection.setex(cle(conversationId, texte), TTL, reponse) } catch { /* cache indisponible */ }
}