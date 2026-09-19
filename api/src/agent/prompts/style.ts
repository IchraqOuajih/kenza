import { readFileSync } from 'node:fs'

const FICHIER = 'data/sujet-02-kenza/conversations.jsonl'

/** Combien de conversations d'exemple par langue. Chaque bloc coûte des tokens
 *  à chaque appel : on reste volontairement frugal. */
const COMBIEN: Record<string, number> = { darija: 2, ar: 1, fr: 1 }
const MAX_TOURS = 4

type Tour = { role: string; texte: string }
type Conv = { id: string; langue: string; intention: string; tours: Tour[] }

function charger(): Conv[] {
  try {
    return readFileSync(FICHIER, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(l => JSON.parse(l))
  } catch {
    return []
  }
}

/** On écarte les tours techniques du jeu de données : [note vocale], [relance…]. */
const utilisable = (t: Tour) => !t.texte.trim().startsWith('[')

/**
 * Le ton de la boutique, tiré des conversations réelles fournies par le commerçant.
 * Le modèle imite la FORME. Les chiffres, eux, viennent toujours des outils.
 */
export function exemplesDeStyle(): string {
  const convs = charger()
  const blocs: string[] = []

  for (const [langue, combien] of Object.entries(COMBIEN)) {
    const choisies = convs.filter(c => c.langue === langue).slice(0, combien)
    for (const c of choisies) {
      const tours = c.tours.filter(utilisable).slice(0, MAX_TOURS)
      if (tours.length < 2) continue
      blocs.push(
        tours.map(t => `${t.role === 'client' ? 'Client' : 'Kenza'} : ${t.texte}`).join('\n')
      )
    }
  }

  if (!blocs.length) return ''

  return `

EXEMPLES DE TON — extraits des conversations réelles de la boutique
(data/sujet-02-kenza/conversations.jsonl). Imite cette LANGUE et ce RYTHME :
phrases très courtes, chaleureuses, une question directe à la fin.
N'imite JAMAIS les chiffres, les produits ni les villes qui y figurent :
ils sont périmés, seuls les outils font foi.

${blocs.join('\n\n')}
`
}