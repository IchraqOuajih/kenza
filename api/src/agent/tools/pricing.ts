import { db } from '../../db/client'
import { REMISE_MAX_PCT } from './policy'

/** Tout en centimes : jamais de float sur de l'argent. */
const enCentimes = (mad: string | number) => Math.round(Number(mad) * 100)
export const enMad = (c: number) => (c / 100).toFixed(2)

export type InfoProduit = {
  ref: string
  modele: string
  couleur: string
  taille: string
  matiere: string
  unitaireCentimes: number
  enPromo: boolean
}

/**
 * Le produit ET son prix du jour, dans la même requête.
 * Les deux doivent voyager ensemble : c'est ce qui empêche le modèle
 * d'attribuer le prix d'un article à un autre.
 */
export async function infoProduit(ref: string): Promise<InfoProduit> {
  const { rows } = await db.query(
    `SELECT p.ref, p.modele, p.couleur, p.taille, p.matiere, p.prix_mad,
            (SELECT prix_promo_mad FROM promotions
             WHERE ref = p.ref AND CURRENT_DATE BETWEEN debut AND fin
             LIMIT 1) AS promo
     FROM produits p WHERE p.ref = $1`,
    [ref]
  )
  if (!rows[0]) throw new Error(
    `Référence inconnue : ${ref}. Appelle rechercher_produit pour obtenir la référence exacte au format REF-0000.`
  )
  const r = rows[0]
  return {
    ref: r.ref,
    modele: r.modele,
    couleur: r.couleur,
    taille: r.taille,
    matiere: r.matiere,
    unitaireCentimes: enCentimes(r.promo ?? r.prix_mad),
    enPromo: r.promo != null,
  }
}

/** Prix unitaire du jour : la promotion en cours prime sur le prix normal. */
export async function prixUnitaire(ref: string): Promise<number> {
  return (await infoProduit(ref)).unitaireCentimes
}

/* ─────────── Les villes telles que les clients les écrivent ─────────── */

/** « Fès » → « fes », « Tétouan » → « tetouan ». */
export function sansAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/** Noms usuels en darija et abréviations courantes. */
const ALIAS: Record<string, string> = {
  casa: 'Casablanca', 'dar lbida': 'Casablanca', 'dar el beida': 'Casablanca', bida: 'Casablanca',
  rbat: 'Rabat',
  fas: 'Fès', fez: 'Fès',
  kech: 'Marrakech', marrakch: 'Marrakech', murakch: 'Marrakech',
  tanja: 'Tanger', tangier: 'Tanger',
  agadire: 'Agadir', agadirr: 'Agadir',
  meknas: 'Meknès',
  wjda: 'Oujda', oujdaa: 'Oujda',
  qnitra: 'Kénitra', knitra: 'Kénitra',
  titwan: 'Tétouan', tetwan: 'Tétouan',
  sla: 'Salé',
  mohamadia: 'Mohammedia', mohamdia: 'Mohammedia',
}

/** Ce que le client a tapé → une clé comparable à la grille. */
export function cleVille(v: string): string {
  const brut = sansAccents(v)
  const alias = ALIAS[brut]
  return alias ? sansAccents(alias) : brut
}

export type Livraison = {
  villeConnue: boolean
  ville: string            // le nom officiel, tel qu'il figure dans la grille
  fraisCentimes: number
  delaiHeures: number | null
  paiementLivraison: boolean
  retraitBoutique: boolean
}

const SANS_ACCENTS_SQL =
  `translate(lower(ville), 'àáâãäçèéêëìíîïñòóôõöùúûü', 'aaaaaceeeeiiiinooooouuuu')`

/** Ville absente de la grille → escalade, jamais d'estimation. */
export async function computeDelivery(ville: string): Promise<Livraison> {
  const { rows } = await db.query(
    `SELECT ville, frais_mad, delai_heures, paiement_a_la_livraison, retrait_boutique
     FROM livraison WHERE ${SANS_ACCENTS_SQL} = $1`,
    [cleVille(ville)]
  )
  if (!rows[0]) {
    return {
      villeConnue: false, ville: ville.trim(), fraisCentimes: 0,
      delaiHeures: null, paiementLivraison: false, retraitBoutique: false,
    }
  }
  return {
    villeConnue: true,
    ville: rows[0].ville,
    fraisCentimes: enCentimes(rows[0].frais_mad),
    delaiHeures: rows[0].delai_heures,
    paiementLivraison: rows[0].paiement_a_la_livraison,
    retraitBoutique: rows[0].retrait_boutique,
  }
}

/** La grille complète : pour dire au client où l'on livre, au lieu de le laisser sans réponse. */
export async function villesLivrees(): Promise<string[]> {
  const { rows } = await db.query(`SELECT ville FROM livraison ORDER BY ville`)
  return rows.map(r => r.ville)
}

export type Ligne = { ref: string; quantite: number }

export type LigneDevis = {
  ref: string
  modele: string
  couleur: string
  taille: string
  matiere: string
  quantite: number
  unitaire: number      // centimes
  total: number         // centimes
  enPromo: boolean
}

export type Devis = {
  lignes: LigneDevis[]
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
  const detail: LigneDevis[] = []
  let sousTotal = 0

  for (const l of lignes) {
    const p = await infoProduit(l.ref)
    const total = p.unitaireCentimes * l.quantite
    sousTotal += total
    detail.push({
      ref: p.ref,
      modele: p.modele,
      couleur: p.couleur,
      taille: p.taille,
      matiere: p.matiere,
      quantite: l.quantite,
      unitaire: p.unitaireCentimes,
      total,
      enPromo: p.enPromo,
    })
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