import { connection } from '../jobs/queue'

/**
 * Mémoire des références réellement vues par le client dans cette conversation.
 * Le modèle ne peut engager la boutique que sur ces références-là.
 */

const cle = (conversationId: string) => `refs:${conversationId}`
const TTL = 3600

/** Extrait toutes les REF-0000 d'un résultat d'outil, à n'importe quelle profondeur. */
function extraire(x: any, acc: string[] = []): string[] {
  if (x == null) return acc
  if (typeof x === 'string') {
    if (/^REF-\d{4}$/.test(x)) acc.push(x)
    return acc
  }
  if (Array.isArray(x)) { for (const v of x) extraire(v, acc); return acc }
  if (typeof x === 'object') { for (const v of Object.values(x)) extraire(v, acc); return acc }
  return acc
}

export async function memoriserRefs(conversationId: string, sortie: any) {
  try {
    const refs = [...new Set(extraire(sortie))]
    if (!refs.length) return
    await connection.sadd(cle(conversationId), ...refs)
    await connection.expire(cle(conversationId), TTL)
  } catch { /* Redis indisponible : on ne bloque pas la conversation */ }
}

/** Les références que le modèle n'a jamais obtenues par une recherche. */
export async function refsInconnues(conversationId: string, refs: string[]): Promise<string[]> {
  if (!refs.length) return []
  try {
    const vues = await Promise.all(
      refs.map(r => connection.sismember(cle(conversationId), r))
    )
    return refs.filter((_, i) => !vues[i])
  } catch {
    return []  // Redis indisponible : on laisse passer plutôt que de casser la vente
  }
}