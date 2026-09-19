import { db } from '../../db/client'

/** Promotions réellement actives aujourd'hui, sur des produits en stock. */
export async function promotionsEnCours(limit = 8) {
  const { rows } = await db.query(
    `SELECT pr.ref, p.modele, p.couleur, p.taille, p.stock,
            pr.prix_normal_mad, pr.prix_promo_mad, pr.fin, pr.condition
     FROM promotions pr
     JOIN produits p ON p.ref = pr.ref
     WHERE CURRENT_DATE BETWEEN pr.debut AND pr.fin
       AND p.stock > 0
     ORDER BY (pr.prix_normal_mad - pr.prix_promo_mad) DESC
     LIMIT $1`,
    [limit]
  )

  if (!rows.length) {
    return {
      promotions: [],
      verifie: true,
      message: "Aucune promotion active aujourd'hui sur un produit en stock.",
    }
  }

  return {
    verifie: true,
    promotions: rows.map(r => {
      const normal = Number(r.prix_normal_mad)
      const promo = Number(r.prix_promo_mad)
      return {
        ref: r.ref,
        modele: r.modele,
        couleur: r.couleur,
        taille: r.taille,
        stock: r.stock,
        prix_normal_mad: normal.toFixed(2),
        prix_promo_mad: promo.toFixed(2),
        remise_pct: normal > 0 ? Math.round((1 - promo / normal) * 100) : 0,
        valable_jusqu_au: r.fin instanceof Date ? r.fin.toISOString().slice(0, 10) : r.fin,
        condition: r.condition,
      }
    }),
  }
}