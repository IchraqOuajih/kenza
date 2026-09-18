import { db } from '../../db/client'

export type Produit = {
  ref: string; modele: string; famille: string; couleur: string
  taille: string; matiere: string; prix_mad: string; stock: number
}

/** Recherche mot à mot sur le catalogue : tous les mots, sinon au moins un. */
export async function searchProducts(query: string, limit = 5): Promise<Produit[]> {
  const mots = query.toLowerCase().split(/\s+/).filter(m => m.length > 2)
  if (!mots.length) return []

  const base = `SELECT ref, modele, famille, couleur, taille, matiere, prix_mad, stock FROM (
      SELECT *, lower(modele||' '||famille||' '||couleur||' '||taille||' '||matiere) AS txt
      FROM produits
    ) p WHERE `

  const params = mots.map(m => `%${m}%`)
  const conds  = mots.map((_, i) => `txt ILIKE $${i + 1}`)

  for (const op of [' AND ', ' OR ']) {
    const { rows } = await db.query(
      `${base}${conds.join(op)} ORDER BY stock DESC LIMIT ${limit}`, params
    )
    if (rows.length) return rows
  }
  return []
}

/** Un produit précis par sa référence. */
export async function getProduct(ref: string): Promise<Produit | null> {
  const { rows } = await db.query(`SELECT * FROM produits WHERE ref = $1`, [ref])
  return rows[0] ?? null
}

/** Stock réel. Zéro = indisponible. */
export async function checkStock(ref: string): Promise<number> {
  const { rows } = await db.query(`SELECT stock FROM produits WHERE ref = $1`, [ref])
  return rows[0]?.stock ?? 0
}

/** Alternatives réellement disponibles, même famille. */
export async function findAlternatives(ref: string, limit = 3): Promise<Produit[]> {
  const { rows } = await db.query(
    `SELECT p.ref, p.modele, p.famille, p.couleur, p.taille, p.matiere, p.prix_mad, p.stock
     FROM produits p
     WHERE p.famille = (SELECT famille FROM produits WHERE ref = $1)
       AND p.ref <> $1 AND p.stock > 0
     ORDER BY p.stock DESC LIMIT $2`,
    [ref, limit]
  )
  return rows
}