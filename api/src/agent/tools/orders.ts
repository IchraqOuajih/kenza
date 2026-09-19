import { db } from '../../db/client'
import { computePrice, enMad, type Ligne } from './pricing'

export type Commande = {
  commande_id: string
  total_mad: string
  sous_total_mad: string
  remise_pct: number
  livraison_mad: string
  delai_heures: number | null
  lignes: { ref: string; quantite: number }[]
}

/**
 * Crée la commande en transaction : vérifie le stock, le décrémente,
 * écrit la commande et ses lignes. Si quoi que ce soit échoue, rien n'est écrit.
 */
export async function creerCommande(
  clientId: string,
  lignes: Ligne[],
  ville: string,
  remisePct = 0
): Promise<Commande> {
  const devis = await computePrice(lignes, ville, remisePct)

  if (!devis.livraison.villeConnue) {
    throw new Error(`Ville hors grille de livraison : ${ville}. Escalade requise, pas de commande.`)
  }

  const c = await db.connect()
  try {
    await c.query('BEGIN')

    await c.query(
      `INSERT INTO clients (client_id) VALUES ($1) ON CONFLICT (client_id) DO NOTHING`,
      [clientId]
    )

    for (const l of lignes) {
      const { rows } = await c.query(
        `SELECT modele, stock FROM produits WHERE ref = $1 FOR UPDATE`, [l.ref]
      )
      if (!rows[0]) throw new Error(`Référence inconnue : ${l.ref}`)
      if (rows[0].stock < l.quantite) {
        throw new Error(
          `Stock insuffisant pour ${l.ref} (${rows[0].modele}) : ${rows[0].stock} disponible(s), ${l.quantite} demandé(s).`
        )
      }
    }

    const { rows: [{ next }] } = await c.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(commande_id FROM 5) AS INTEGER)), 0) + 1 AS next
       FROM commandes WHERE commande_id LIKE 'CMD-%'`
    )
    const commandeId = 'CMD-' + String(next).padStart(5, '0')

    await c.query(
      `INSERT INTO commandes (commande_id, client_id, date, canal, statut,
         total_articles_mad, frais_livraison_mad, total_mad, ville_livraison,
         paiement, creee_par_agent)
       VALUES ($1,$2,CURRENT_DATE,'whatsapp','en préparation',$3,$4,$5,$6,$7,TRUE)`,
      [
        commandeId, clientId,
        enMad(devis.sousTotal - devis.remiseCentimes),
        enMad(devis.livraison.fraisCentimes),
        enMad(devis.total),
        ville,
        devis.livraison.paiementLivraison ? 'à la livraison' : 'lien de paiement',
      ]
    )

    for (const l of devis.lignes) {
      const { rows } = await c.query(`SELECT modele, taille FROM produits WHERE ref = $1`, [l.ref])
      await c.query(
        `INSERT INTO commande_lignes (commande_id, ref, modele, taille, quantite, prix_unitaire_mad)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [commandeId, l.ref, rows[0].modele, rows[0].taille, l.quantite, enMad(l.unitaire)]
      )
      await c.query(`UPDATE produits SET stock = stock - $1 WHERE ref = $2`, [l.quantite, l.ref])
    }

    await c.query('COMMIT')

    return {
      commande_id: commandeId,
      sous_total_mad: enMad(devis.sousTotal),
      remise_pct: devis.remisePct,
      livraison_mad: enMad(devis.livraison.fraisCentimes),
      delai_heures: devis.livraison.delaiHeures,
      total_mad: enMad(devis.total),
      lignes: lignes.map(l => ({ ref: l.ref, quantite: l.quantite })),
    }
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  } finally {
    c.release()
  }
}

/** Les commandes que ce client peut encore annuler. */
export async function commandesAnnulables(clientId: string) {
  const { rows } = await db.query(
    `SELECT c.commande_id, c.total_mad, c.ville_livraison, c.statut, c.created_at,
            json_agg(json_build_object('ref', l.ref, 'modele', l.modele, 'quantite', l.quantite)) AS articles
     FROM commandes c
     LEFT JOIN commande_lignes l ON l.commande_id = c.commande_id
     WHERE c.client_id = $1 AND c.statut = 'en préparation'
     GROUP BY c.commande_id, c.total_mad, c.ville_livraison, c.statut, c.created_at
     ORDER BY c.created_at DESC LIMIT 5`,
    [clientId]
  )
  return rows
}

/**
 * Annule une commande et remet les articles en stock, en transaction.
 * Une commande déjà livrée ou déjà annulée n'est pas annulable ici.
 */
export async function annulerCommande(clientId: string, commandeId: string) {
  const c = await db.connect()
  try {
    await c.query('BEGIN')

    const { rows } = await c.query(
      `SELECT statut, total_mad FROM commandes
       WHERE commande_id = $1 AND client_id = $2 FOR UPDATE`,
      [commandeId, clientId]
    )
    if (!rows[0]) {
      throw new Error(`Commande ${commandeId} introuvable pour ce client.`)
    }
    if (rows[0].statut === 'annulée') {
      throw new Error(`La commande ${commandeId} est déjà annulée.`)
    }
    if (rows[0].statut === 'livrée') {
      throw new Error(
        `La commande ${commandeId} est déjà livrée : l'annulation relève du commerçant. Appelle escalader avec le motif reclamation.`
      )
    }

    const { rows: lignes } = await c.query(
      `SELECT ref, modele, quantite FROM commande_lignes WHERE commande_id = $1`,
      [commandeId]
    )
    for (const l of lignes) {
      await c.query(`UPDATE produits SET stock = stock + $1 WHERE ref = $2`, [l.quantite, l.ref])
    }

    await c.query(`UPDATE commandes SET statut = 'annulée' WHERE commande_id = $1`, [commandeId])
    await c.query('COMMIT')

    return {
      annulee: true,
      commande_id: commandeId,
      montant_annule_mad: rows[0].total_mad,
      articles_remis_en_stock: lignes,
    }
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  } finally {
    c.release()
  }
}

/** Mémoire : les commandes passées d'un client. */
export async function historiqueClient(clientId: string, limit = 3) {
  const { rows } = await db.query(
    `SELECT c.commande_id, c.date, c.statut, c.total_mad,
            json_agg(json_build_object('ref', l.ref, 'modele', l.modele, 'quantite', l.quantite)) AS articles
     FROM commandes c
     LEFT JOIN commande_lignes l ON l.commande_id = c.commande_id
     WHERE c.client_id = $1
     GROUP BY c.commande_id, c.date, c.statut, c.total_mad
     ORDER BY c.date DESC LIMIT $2`,
    [clientId, limit]
  )
  return rows
}