import type { FastifyInstance } from 'fastify'
import { db } from '../db/client'

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/api/dashboard', async () => {
    const { rows: [k] } = await db.query(`
      SELECT
        (SELECT count(*) FROM conversations)                                      AS conversations,
        (SELECT count(*) FROM conversations WHERE statut = 'ouverte')             AS conversations_ouvertes,
        (SELECT count(*) FROM commandes WHERE creee_par_agent)                    AS commandes_agent,
        (SELECT COALESCE(SUM(total_mad), 0) FROM commandes WHERE creee_par_agent) AS ca_agent,
        (SELECT count(*) FROM escalades WHERE statut = 'ouverte')                 AS escalades_ouvertes,
        (SELECT count(*) FROM paniers WHERE statut = 'relance')                   AS relances_envoyees,
        (SELECT count(*) FROM paniers WHERE statut = 'ouvert')                    AS relances_en_attente,
        (SELECT count(DISTINCT c.id)
           FROM conversations c
           JOIN commandes o
             ON o.client_id = c.client_id
            AND o.creee_par_agent
            AND o.created_at >= c.created_at)                                     AS conversations_converties
    `)

    const conversations = Number(k.conversations) || 0
    const converties = Number(k.conversations_converties) || 0
    // Part des conversations ayant abouti à au moins une commande — plafonné à 100 %.
    const conversion = conversations ? Math.round((converties / conversations) * 100) : 0

    const { rows: dernieresCommandes } = await db.query(`
      SELECT commande_id, client_id, total_mad, ville_livraison, statut, created_at
      FROM commandes WHERE creee_par_agent
      ORDER BY created_at DESC LIMIT 8
    `)

    const { rows: escalades } = await db.query(`
      SELECT e.id, e.motif, e.contexte, e.created_at, c.client_id
      FROM escalades e
      LEFT JOIN conversations c ON c.id = e.conversation_id
      WHERE e.statut = 'ouverte'
      ORDER BY e.created_at DESC LIMIT 8
    `)

    const { rows: fils } = await db.query(`
      SELECT c.client_id, c.canal, c.statut, c.updated_at, count(m.id) AS messages
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      GROUP BY c.id
      ORDER BY c.updated_at DESC LIMIT 8
    `)

    return {
      kpis: {
        conversations,
        conversationsOuvertes: Number(k.conversations_ouvertes) || 0,
        commandes: Number(k.commandes_agent) || 0,
        caAgent: Number(k.ca_agent) || 0,
        conversion,
        escalades: Number(k.escalades_ouvertes) || 0,
        relancesEnvoyees: Number(k.relances_envoyees) || 0,
        relancesEnAttente: Number(k.relances_en_attente) || 0,
      },
      dernieresCommandes,
      escalades,
      fils,
    }
  })
}