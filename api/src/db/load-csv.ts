import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { Client } from 'pg'
import 'dotenv/config'

const DIR = 'data/sujet-02-kenza'

function lire(nom: string): any[] {
  return parse(readFileSync(`${DIR}/${nom}`, 'utf8'),
    { columns: true, skip_empty_lines: true, trim: true })
}

const num  = (v: string) => (v === '' || v == null ? null : Number(v))
const bool = (v: string) => /^(oui|yes|true|1)$/i.test(v ?? '')
const date = (v: string) => (v === '' || v == null ? null : v)

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()

  for (const p of lire('catalogue.csv')) {
    await db.query(
      `INSERT INTO produits (ref, modele, famille, genre, couleur, taille, matiere,
        saison, prix_mad, stock, delai_reassort_jours, code_barre, poids_g)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (ref) DO NOTHING`,
      [p.ref, p.modele, p.famille, p.genre, p.couleur, p.taille, p.matiere,
       p.saison, num(p.prix_mad), num(p.stock) ?? 0,
       num(p.delai_reassort_jours), p.code_barre, num(p.poids_g)])
  }

  for (const c of lire('clients.csv')) {
    await db.query(
      `INSERT INTO clients (client_id, nom, telephone, ville, langue_preferee,
        premier_achat, nb_commandes, segment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (client_id) DO NOTHING`,
      [c.client_id, c.nom, c.telephone, c.ville, c.langue_preferee,
       date(c.premier_achat), num(c.nb_commandes), c.segment])
  }

  for (const l of lire('livraison.csv')) {
    await db.query(
      `INSERT INTO livraison (ville, frais_mad, delai_heures,
        paiement_a_la_livraison, retrait_boutique)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (ville) DO NOTHING`,
      [l.ville, num(l.frais_mad), num(l.delai_heures),
       bool(l.paiement_a_la_livraison), bool(l.retrait_boutique)])
  }

  for (const p of lire('promotions.csv')) {
    await db.query(
      `INSERT INTO promotions (ref, prix_normal_mad, prix_promo_mad, debut, fin, condition)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [p.ref, num(p.prix_normal_mad), num(p.prix_promo_mad),
       date(p.debut), date(p.fin), p.condition])
  }

  for (const c of lire('commandes.csv')) {
    await db.query(
      `INSERT INTO commandes (commande_id, client_id, date, canal, statut,
        total_articles_mad, frais_livraison_mad, total_mad, ville_livraison, paiement)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (commande_id) DO NOTHING`,
      [c.commande_id, c.client_id, date(c.date), c.canal, c.statut,
       num(c.total_articles_mad), num(c.frais_livraison_mad),
       num(c.total_mad), c.ville_livraison, c.paiement])
  }

  for (const l of lire('commandes-lignes.csv')) {
    await db.query(
      `INSERT INTO commande_lignes (commande_id, ref, modele, taille, quantite, prix_unitaire_mad)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [l.commande_id, l.ref, l.modele, l.taille, num(l.quantite), num(l.prix_unitaire_mad)])
  }

  const r = await db.query(`SELECT
      (SELECT count(*) FROM produits) AS produits,
      (SELECT count(*) FROM clients) AS clients,
      (SELECT count(*) FROM livraison) AS villes,
      (SELECT count(*) FROM promotions) AS promos,
      (SELECT count(*) FROM commandes) AS commandes,
      (SELECT count(*) FROM commande_lignes) AS lignes`)
  console.table(r.rows[0])
  await db.end()
}

main().catch((e) => { console.error(e); process.exit(1) })