import { db } from '../../db/client'
import { REMISE_MAX_PCT } from './policy'

/** Tout en centimes : jamais de float sur de l'argent. */
const enCentimes = (mad: string | number) => Math.round(Number(mad) * 100)
export const enMad = (c: number) => (c / 100).toFixed(2)

/** Prix unitaire du jour : la promotion en cours prime sur le prix normal. */
export async function prixUnitaire(ref: string): Promise<number> {
  const { rows } = await db.query(
    `SELECT p.prix_mad,
            (SELECT prix_promo_mad FROM promotions
             WHERE ref = p.ref AND CURRENT_DATE BETWEEN debut AND fin
             LIMIT 1) AS promo
     FROM produits p WHERE p.ref = $1`,
    [ref]
  )
  if (!rows[0]) throw new Error(
    `Référence inconnue : ${ref}. Appelle rechercher_produit pour obtenir la référence exacte au format REF-0000.`
  )
  return enCentimes(rows[0].promo ?? rows[0].prix_mad)
}

export type Livraison = {
  villeConnue: boolean
  fraisCentimes: number
  delaiHeures: number | null
  paiementLivraison: boolean
}

/** Ville absente de la grille → escalade, jamais d'estimation. */
export async function computeDelivery(ville: string): Promise<Livraison> {
  const { rows } = await db.query(
    `SELECT frais_mad, delai_heures, paiement_a_la_livraison
     FROM livraison WHERE lower(ville) = lower($1)`,
    [ville]
  )
  if (!rows[0]) {
    return { villeConnue: false, fraisCentimes: 0, delaiHeures: null, paiementLivraison: false }
  }
  return {
    villeConnue: true,
    fraisCentimes: enCentimes(rows[0].frais_mad),
    delaiHeures: rows[0].delai_heures,
    paiementLivraison: rows[0].paiement_a_la_livraison,
  }
}

export type Ligne = { ref: string; quantite: number }

export type Devis = {
  lignes: { ref: string; quantite: number; unitaire: number; total: number }[]
  sousTotal: number
  remisePct: number
  remiseCentimes: number
  livraison: Livraison
  total: number
  remisePlafonnee: boolean
}

/**
 * Calcule le devis complet.
 * La remise est plafonnée à REMISE_MAX_PCT dans le code :
 * le modèle ne peut pas franchir ce plancher, quoi qu'il demande.
 */
export async function computePrice(
  lignes: Ligne[],
  ville: string,
  remiseDemandeePct = 0
): Promise<Devis> {
  const detail: Devis['lignes'] = []
  let sousTotal = 0

  for (const l of lignes) {
    const unitaire = await prixUnitaire(l.ref)
    const total = unitaire * l.quantite
    sousTotal += total
    detail.push({ ref: l.ref, quantite: l.quantite, unitaire, total })
  }

  const remisePlafonnee = remiseDemandeePct > REMISE_MAX_PCT * 100
  const remisePct = Math.min(Math.max(remiseDemandeePct, 0), REMISE_MAX_PCT * 100)
  const remiseCentimes = Math.round((sousTotal * remisePct) / 100)

  const livraison = await computeDelivery(ville)

  return {
    lignes: detail,
    sousTotal,
    remisePct,
    remiseCentimes,
    livraison,
    total: sousTotal - remiseCentimes + livraison.fraisCentimes,
    remisePlafonnee,
  }
}