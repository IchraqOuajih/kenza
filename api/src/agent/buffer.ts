/**
 * Un client WhatsApp écrit "salam", "wech", "kayn veste" en trois messages.
 * On attend un court instant, on regroupe, et l'agent répond une seule fois.
 */
type Pending = {
  textes: string[]
  resolvers: ((v: any) => void)[]
  timer: NodeJS.Timeout | null
}

const buffers = new Map<string, Pending>()
const DEBOUNCE_MS = Number(process.env.MESSAGE_DEBOUNCE_MS ?? 2500)

export function bufferiser(
  clientId: string,
  text: string,
  traiter: (texteComplet: string, nb: number) => Promise<any>
): Promise<any> {
  return new Promise((resolve) => {
    let p = buffers.get(clientId)
    if (!p) {
      p = { textes: [], resolvers: [], timer: null }
      buffers.set(clientId, p)
    }
    p.textes.push(text)
    p.resolvers.push(resolve)

    if (p.timer) clearTimeout(p.timer)

    p.timer = setTimeout(async () => {
      const courant = buffers.get(clientId)!
      buffers.delete(clientId)

      let res: any
      try {
        res = await traiter(courant.textes.join('\n'), courant.textes.length)
      } catch (e: any) {
        res = { text: 'Sam7 lia, kayn chi mochkil tekniki. 3awd men fadlek.', traces: [] }
      }

      // Seule la dernière requête reçoit la réponse ; les précédentes sont muettes.
      const dernier = courant.resolvers.length - 1
      courant.resolvers.forEach((r, i) =>
        r(i === dernier ? res : { text: '', traces: [], bufferise: true })
      )
    }, DEBOUNCE_MS)
  })
}