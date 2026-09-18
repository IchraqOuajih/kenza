import { getModel } from './llm'
import { searchProducts, checkStock, findAlternatives } from './tools/catalogue'
import { computePrice, enMad } from './tools/pricing'
import { creerCommande, historiqueClient } from './tools/orders'
import { REMISE_MAX_PCT } from './tools/policy'
import {
  getOrCreateConversation, chargerHistorique,
  sauverMessage, sauverTraces, sauverEscalade,
} from '../db/conversations'

export type Trace = { etape: string; outil?: string; entree?: any; sortie?: any; decision: string }
export type Incoming = { clientId: string; text: string; channel: string }
export type Outgoing = { text: string; traces: Trace[] }

const SYSTEM = `Tu es Kenza, vendeuse d'une boutique marocaine de prêt-à-porter.
Tu réponds en darija si le client écrit en darija, en français s'il écrit en français, en arabe s'il écrit en arabe.
Tu es chaleureuse, brève, concrète.
Tu écris la darija en caractères latins (arabizi), jamais en alphabet arabe.
Exception : si le client t'écrit en alphabet arabe, tu réponds entièrement en alphabet arabe.
Un message = un seul alphabet. Ne mélange jamais les deux, même pour un seul mot.

RÈGLES ABSOLUES :
- Tu n'annonces JAMAIS un prix, un stock ou un frais de livraison sans avoir appelé l'outil correspondant.
- Tu utilises toujours les références exactes du catalogue (format REF-0000), obtenues via rechercher_produit. Tu n'en inventes jamais.
- Si un stock vaut 0, tu DOIS appeler alternatives avant de répondre, et proposer ce qui est réellement disponible.
- Tu ne dis jamais qu'un produit n'existe pas sans avoir cherché avec des mots-clés différents.
- Tu ne promets JAMAIS de date de réassort.
- Remise maximale ${REMISE_MAX_PCT * 100}%. Au-delà, tu escalades.
- Ville absente de la grille de livraison → tu escalades, tu n'estimes pas.
- Facture au nom d'une société, réclamation, remboursement en espèces → tu escalades.
- Dès qu'une escalade est nécessaire, tu DOIS appeler l'outil escalader. Dire que tu transmets sans l'appeler est une faute.
- Tu ne crées JAMAIS une commande sans confirmation explicite du client, et sans connaître sa ville de livraison.
- Après création d'une commande, tu annonces le numéro et le total exacts renvoyés par l'outil.
- Tu te souviens de la conversation. Ne redemande jamais une information que le client t'a déjà donnée.
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
    description: "Produits disponibles de la même famille. À appeler dès qu'un stock vaut 0.",
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
    name: 'creer_commande',
    description: "Enregistre la commande en base et décrémente le stock. À n'appeler QUE lorsque le client a confirmé explicitement et que la ville de livraison est connue.",
    parameters: { type: 'object', properties: {
      lignes: { type: 'array', items: { type: 'object', properties: {
        ref: { type: 'string', description: 'Référence exacte, format REF-0000.' },
        quantite: { type: 'number' },
      }, required: ['ref', 'quantite'] } },
      ville: { type: 'string' },
      remise_pct: { type: 'number' },
    }, required: ['lignes', 'ville'] },
  }},
  { type: 'function' as const, function: {
    name: 'historique_client',
    description: 'Commandes passées du client. À appeler quand le client fait référence à un achat précédent.',
    parameters: { type: 'object', properties: {}, required: [] },
  }},
  { type: 'function' as const, function: {
    name: 'escalader',
    description: 'Transfère au commerçant avec le contexte. Obligatoire pour : ville hors grille, remise sous plancher, facture société, réclamation, remboursement en espèces, demande hors catalogue.',
    parameters: { type: 'object', properties: {
      motif: { type: 'string' }, resume: { type: 'string' },
    }, required: ['motif', 'resume'] },
  }},
]

type Ctx = { clientId: string; conversationId: string }

async function executer(nom: string, args: any, ctx: Ctx) {
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
    case 'creer_commande':
      return await creerCommande(ctx.clientId, args.lignes, args.ville, args.remise_pct ?? 0)
    case 'historique_client':
      return await historiqueClient(ctx.clientId)
    case 'escalader': {
      const id = await sauverEscalade(ctx.conversationId, args.motif, args.resume)
      return { escalade_enregistree: true, ticket: id, ...args }
    }
    default: throw new Error(`Outil inconnu : ${nom}`)
  }
}

const MAX_TOURS = 6

export async function handleMessage(msg: Incoming): Promise<Outgoing> {
  const { client, model } = getModel('fast')
  const conversationId = await getOrCreateConversation(msg.clientId, msg.channel)
  const historique = await chargerHistorique(conversationId)
  const ctx: Ctx = { clientId: msg.clientId, conversationId }

  const traces: Trace[] = []
  const messages: any[] = [
    { role: 'system', content: SYSTEM },
    ...historique,
    { role: 'user', content: msg.text },
  ]

  await sauverMessage(conversationId, 'client', msg.text)

  const terminer = async (text: string): Promise<Outgoing> => {
    await sauverMessage(conversationId, 'agent', text)
    await sauverTraces(conversationId, traces)
    return { text, traces }
  }

  for (let tour = 0; tour < MAX_TOURS; tour++) {
    const r = await client.chat.completions.create({
      model, messages, tools: TOOLS, parallel_tool_calls: false,
    })
    const m = r.choices[0].message
    messages.push(m)

    if (!m.tool_calls?.length) {
      traces.push({ etape: 'réponse', decision: "assez d'informations pour répondre" })
      return await terminer(m.content ?? '')
    }

    for (const tc of m.tool_calls as any[]) {
      const args = JSON.parse(tc.function.arguments || '{}')
      let sortie: any
      try {
        sortie = await executer(tc.function.name, args, ctx)
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
  return await terminer('Je transmets votre demande au commerçant, il revient vers vous.')
}