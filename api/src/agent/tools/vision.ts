import { db } from '../../db/client'
import { getModel } from '../llm'

export type Apercu = { famille: string | null; couleur: string | null; brut: string }

/** Le vocabulaire autorisé vient du catalogue, pas de l'imagination du modèle. */
async function vocabulaire() {
  const { rows: f } = await db.query(`SELECT DISTINCT famille FROM produits ORDER BY famille`)
  const { rows: c } = await db.query(`SELECT DISTINCT couleur FROM produits ORDER BY couleur`)
  return { familles: f.map(r => r.famille), couleurs: c.map(r => r.couleur) }
}

/**
 * Regarde la photo et la traduit en deux valeurs du catalogue : famille et couleur.
 * On ne demande NI la matière NI la taille : une photo ne les donne pas de façon fiable.
 * detail: 'low' → l'image est ramenée à ~512 px, ce qui suffit ici
 * et coûte une centaine de tokens au lieu de plus de mille.
 */
export async function decrireImage(dataUrl: string): Promise<Apercu> {
  const { familles, couleurs } = await vocabulaire()
  const { client, model } = getModel('fast')

  const consigne = `Tu regardes la photo d'un article envoyée par un client de boutique.

Réponds UNIQUEMENT par un objet JSON, sans texte autour, sans balises :
{"famille": "...", "couleur": "..."}

famille : obligatoirement l'une de ces valeurs exactes, sinon null
${familles.map(x => `- ${x}`).join('\n')}

couleur : obligatoirement l'une de ces valeurs exactes, sinon null
${couleurs.map(x => `- ${x}`).join('\n')}

Tu ne devines JAMAIS la matière ni la taille : on ne te les demande pas.
Si la photo ne montre ni vêtement ni accessoire, réponds {"famille": null, "couleur": null}.`

  const r = await client.chat.completions.create({
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: consigne },
        { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
      ] as any,
    }],
    max_tokens: 60,
    temperature: 0,
  })

  const brut = (r.choices[0].message.content ?? '').trim()
  let famille: string | null = null
  let couleur: string | null = null

  try {
    const j = JSON.parse(brut.replace(/```json|```/g, '').trim())
    if (typeof j.famille === 'string' && familles.includes(j.famille)) famille = j.famille
    if (typeof j.couleur === 'string' && couleurs.includes(j.couleur)) couleur = j.couleur
  } catch { /* réponse non exploitable : on reste sur null, jamais sur une invention */ }

  return { famille, couleur, brut }
}