import { Worker } from 'bullmq'
import { connection } from './jobs/queue'
import { db } from './db/client'
import { getModel } from './agent/llm'
import { sauverMessage } from './db/conversations'
import 'dotenv/config'

const PROMPT = `Tu es Kenza, vendeuse marocaine. Tu relances un client qui a montré
de l'intérêt mais n'a pas commandé. Écris UN seul message court, chaleureux, en darija
en caractères latins. Rappelle le produit, n'invente aucun prix, ne mets aucune pression.
Termine par une question simple.`

new Worker('relances', async (job) => {
  const { panierId, conversationId, clientId, lignes, raison } = job.data

  // Le panier est-il encore ouvert ?
  const { rows: panier } = await db.query(
    `SELECT statut, updated_at FROM paniers WHERE id = $1`, [panierId]
  )
  if (!panier[0] || panier[0].statut !== 'ouvert') {
    console.log(`[relance] panier ${panierId} déjà traité, rien à faire`)
    return
  }

  // Le client a-t-il commandé DEPUIS la création du panier ?
  const { rows: cmd } = await db.query(
    `SELECT commande_id FROM commandes
     WHERE client_id = $1 AND creee_par_agent = TRUE AND created_at > $2 LIMIT 1`,
    [clientId, panier[0].updated_at]
  )
  if (cmd.length) {
    await db.query(`UPDATE paniers SET statut = 'commande' WHERE id = $1`, [panierId])
    console.log(`[relance] ${clientId} a commandé (${cmd[0].commande_id}), relance annulée`)
    return
  }

  // Le produit est-il toujours disponible ?
  const refs = lignes.map((l: any) => l.ref)
  const { rows: produits } = await db.query(
    `SELECT ref, modele, couleur, stock FROM produits WHERE ref = ANY($1)`, [refs]
  )
  const dispo = produits.filter(p => p.stock > 0)
  if (!dispo.length) {
    await db.query(`UPDATE paniers SET statut = 'abandonne' WHERE id = $1`, [panierId])
    console.log('[relance] plus de stock, relance annulée')
    return
  }

  const { client, model } = getModel('reasoning')
  const r = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: PROMPT },
      { role: 'user', content:
        `Produits : ${dispo.map(p => `${p.modele} (${p.couleur})`).join(', ')}\n` +
        `Raison de la relance : ${raison}` },
    ],
  })

  const texte = r.choices[0].message.content ?? ''
  await sauverMessage(conversationId, 'agent', texte)
  await db.query(`UPDATE paniers SET statut = 'relance' WHERE id = $1`, [panierId])

  console.log(`[relance] envoyée à ${clientId} : ${texte}`)
}, { connection })

console.log('Worker de relances démarré.')