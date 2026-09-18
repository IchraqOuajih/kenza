import { db } from '../../db/client'

export type Produit = {
  ref: string; modele: string; famille: string; couleur: string
  taille: string; matiere: string; prix_mad: string; stock: number
}

/** Recherche par mots-clés sur le catalogue. */
export async function searchProducts(query: string, limit = 5): Promise<Produit[]> {
  const { rows } = await db.query(
    `SELECT ref, modele, famille, couleur, taille, matiere, prix_mad, stock
     FROM produits
     WHERE modele ILIKE $1 OR famille ILIKE $1 OR couleur ILIKE $1 OR matiere ILIKE $1
     ORDER BY stock DESC
     LIMIT $2`,
    [`%${query}%`, limit]
  )
  return rows
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