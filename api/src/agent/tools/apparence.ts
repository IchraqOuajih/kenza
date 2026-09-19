import { db } from '../../db/client'

const COLONNES = `ref, modele, famille, couleur, taille, matiere, prix_mad, stock`

async function famillesEnStock(): Promise<string[]> {
  const { rows } = await db.query(
    `SELECT famille FROM produits GROUP BY famille HAVING sum(stock) > 0 ORDER BY famille`
  )
  return rows.map(r => r.famille)
}

/**
 * Recherche en deux temps, décidée par le CODE :
 *   1. la famille ET la couleur vues sur la photo
 *   2. à défaut, la même famille dans les couleurs réellement disponibles
 * Le drapeau couleur_exacte dit lequel des deux a répondu.
 * Vaut pour n'importe quelle famille du catalogue, pas seulement les sacs.
 */
export async function rechercherParApparence(famille: string | null, couleur: string | null) {
  if (!famille) {
    return {
      reconnu: false,
      familles_disponibles: await famillesEnStock(),
      message: "Aucun article du catalogue n'a été reconnu sur la photo.",
    }
  }

  if (couleur) {
    const { rows } = await db.query(
      `SELECT ${COLONNES} FROM produits
       WHERE famille = $1 AND couleur = $2 AND stock > 0
       ORDER BY stock DESC LIMIT 5`,
      [famille, couleur]
    )
    if (rows.length) {
      return {
        reconnu: true, famille, couleur_vue: couleur,
        couleur_exacte: true, produits: rows,
      }
    }
  }

  const { rows: memeFamille } = await db.query(
    `SELECT ${COLONNES} FROM produits
     WHERE famille = $1 AND stock > 0
     ORDER BY stock DESC LIMIT 5`,
    [famille]
  )

  if (!memeFamille.length) {
    return {
      reconnu: true, famille, famille_en_stock: false,
      familles_disponibles: await famillesEnStock(),
      message: `Aucun article de la famille ${famille} n'est en stock actuellement.`,
    }
  }

  const { rows: dispo } = await db.query(
    `SELECT DISTINCT couleur FROM produits WHERE famille = $1 AND stock > 0 ORDER BY couleur`,
    [famille]
  )

  return {
    reconnu: true,
    famille,
    couleur_vue: couleur,
    couleur_exacte: false,
    couleurs_disponibles: dispo.map(r => r.couleur),
    produits: memeFamille,
    message: couleur
      ? `Aucun ${famille} en ${couleur} au catalogue. Voici la même famille dans les couleurs réellement disponibles.`
      : `Couleur non identifiable sur la photo. Voici les ${famille} disponibles.`,
  }
}