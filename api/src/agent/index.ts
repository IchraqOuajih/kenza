import { getModel } from './llm'
import { searchProducts, checkStock, findAlternatives } from './tools/catalogue'
import { computePrice, enMad } from './tools/pricing'
import { REMISE_MAX_PCT } from './tools/policy'

export type Trace = { etape: string; outil?: string; entree?: any; sortie?: any; decision: string }
export type Incoming = { clientId: string; text: string; channel: string }
export type Outgoing = { text: string; traces: Trace[] }

const SYSTEM = `Tu es Kenza, vendeuse d'une boutique marocaine de prêt-à-porter.
Tu réponds en darija si le client écrit en darija, en français s'il écrit en français, en arabe s'il écrit en arabe.
Tu es chaleureuse, brève, concrète.

RÈGLES ABSOLUES :
- Tu n'annonces JAMAIS un prix, un stock ou un frais de livraison sans avoir appelé l'outil correspondant.
- Tu utilises toujours les références exactes du catalogue (format REF-0000), obtenues via rechercher_produit. Tu n'en inventes jamais.
- Tu ne promets JAMAIS de date de réassort.
- Remise maximale ${REMISE_MAX_PCT * 100}%. Au-delà, tu escalades.
- Ville absente de la grille de livraison → tu escalades, tu n'estimes pas.
- Facture au nom d'une société, réclamation, remboursement en espèces → tu escalades.
- Si le message est ambigu, tu demandes une précision au lieu de deviner.`

const TOOLS = [
  { type: 'function' as const, function: {
    name: 'rechercher_produit',
    description: 'Cherche des produits dans le catalogue par mots-clés. À appeler avant tout calcul.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  }},
  { type: 'function' as const, function: {
    name: 'verifier_stock',
    description: "Stock réel d'une référence. 0 = indisponible.",
    parameters: { type: 'object', properties: {
      ref: { type: 'string', description: 'Référence exacte du catalogue, format REF-0000.' },
    }, required: ['ref'] },
  }},
  { type: 'function' as const, function: {
    name: 'alternatives',
    description: 'Produits disponibles de la même famille, quand une référence est en rupture.',
    parameters: { type: 'object', properties: {
      ref: { type: 'string', description: 'Référence exacte du catalogue, format REF-0000.' },
    }, required: ['ref'] },
  }},
  { type: 'function' as const, function: {
    name: 'calculer_devis',
    description: 'Calcule le total : prix, remise plafonnée, livraison. Seule source de vérité pour les montants.',
    parameters: { type: 'object', properties: {
      lignes: { type: 'array', items: { type: 'object', properties: {
        ref: { type: 'string', description: 'Référence exacte du catalogue, format REF-0000. Obtenue via rechercher_produit — jamais inventée.' },
        quantite: { type: 'number' },
      }, required: ['ref', 'quantite'] } },
      ville: { type: 'string' },
      remise_pct: { type: 'number' },
    }, required: ['lignes', 'ville'] },
  }},
  { type: 'function' as const, function: {
    name: 'escalader',
    description: "Transfère au commerçant avec le contexte. À utiliser dès qu'une règle l'impose.",
    parameters: { type: 'object', properties: {
      motif: { type: 'string' }, resume: { type: 'string' },
    }, required: ['motif', 'resume'] },
  }},
]

async function executer(nom: string, args: any) {
  switch (nom) {
    case 'rechercher_produit': return await searchProducts(args.query)
    case 'verifier_stock':     return { ref: args.ref, stock: await checkStock(args.ref) }
    case 'alternatives':       return await findAlternatives(args.ref)
    case 'calculer_devis': {
      const d = await computePrice(args.lignes, args.ville, args.remise_pct ?? 0)
      return {
        sous_total_mad: enMad(d.sousTotal),
        remise_pct: d.remisePct,
        remise_plafonnee: d.remisePlafonnee,
        ville_connue: d.livraison.villeConnue,
        livraison_mad: enMad(d.livraison.fraisCentimes),
        delai_heures: d.livraison.delaiHeures,
        total_mad: enMad(d.total),
      }
    }
    case 'escalader': return { escalade: true, ...args }
    default: throw new Error(`Outil inconnu : ${nom}`)
  }
}

const MAX_TOURS = 6

export async function handleMessage(msg: Incoming): Promise<Outgoing> {
  const { client, model } = getModel('fast')
  const traces: Trace[] = []
  const messages: any[] = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: msg.text },
  ]

  for (let tour = 0; tour < MAX_TOURS; tour++) {
    const r = await client.chat.completions.create({
      model, messages, tools: TOOLS, parallel_tool_calls: false,
    })
    const m = r.choices[0].message
    messages.push(m)

    if (!m.tool_calls?.length) {
      traces.push({ etape: 'réponse', decision: "assez d'informations pour répondre" })
      return { text: m.content ?? '', traces }
    }

    for (const tc of m.tool_calls as any[]) {
      const args = JSON.parse(tc.function.arguments || '{}')
      let sortie: any
      try {
        sortie = await executer(tc.function.name, args)
      } catch (e: any) {
        sortie = { erreur: e.message }
      }
      traces.push({
        etape: `tour ${tour + 1}`,
        outil: tc.function.name,
        entree: args,
        sortie,
        decision: sortie?.erreur ? 'outil en échec, je me corrige' : 'résultat obtenu',
      })
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(sortie) })
    }
  }

  traces.push({ etape: 'arrêt', decision: "limite d'itérations atteinte, j'escalade" })
  return { text: 'Je transmets votre demande au commerçant, il revient vers vous.', traces }
}