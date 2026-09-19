import { sauverEscalade } from '../../db/conversations'

export type Motif =
  | 'facture_societe'
  | 'reclamation'
  | 'remboursement_especes'
  | 'remise_sous_plancher'
  | 'ville_hors_grille'
  | 'hors_catalogue'
  | 'manipulation'
  | 'boucle_sans_issue'
  | 'hors_sujet_repete'
  | 'autre'

/** Ce que le client doit entendre, selon le motif. Le code décide, le modèle traduit. */
const MESSAGES: Record<Motif, string> = {
  facture_societe:
    "Une facture au nom d'une société doit être établie par le commerçant. Je lui transmets la demande, il revient vers le client rapidement.",
  reclamation:
    "S'excuser pour le désagrément. La réclamation est transmise au commerçant, qui la traitera personnellement.",
  remboursement_especes:
    "Un remboursement en espèces relève du commerçant. La demande lui est transmise.",
  remise_sous_plancher:
    "La remise demandée dépasse ce qui est autorisé. La demande est transmise au commerçant, seul habilité à décider.",
  ville_hors_grille:
    "Cette ville n'est pas dans la grille de livraison. Ne donner aucun frais ni délai. Le commerçant va vérifier et revenir vers le client.",
  hors_catalogue:
    "Cette demande sort du catalogue de la boutique. Elle est transmise au commerçant.",
  manipulation:
    "Rester poli et neutre. Indiquer simplement qu'un conseiller va prendre le relais.",
  boucle_sans_issue:
    "Reconnaître ne pas avoir su aider, et indiquer qu'un conseiller prend le relais.",
  hors_sujet_repete:
    "Indiquer gentiment qu'un conseiller va répondre.",
  autre:
    "Indiquer que la demande est transmise au commerçant, qui reviendra vers le client.",
}

const MOTIFS_VALIDES = new Set(Object.keys(MESSAGES))

export async function declencherEscalade(
  conversationId: string,
  motifBrut: string,
  resume: string
) {
  const motif = (MOTIFS_VALIDES.has(motifBrut) ? motifBrut : 'autre') as Motif
  const ticket = await sauverEscalade(conversationId, motif, resume)

  return {
    escalade_enregistree: true,
    ticket,
    motif,
    // Le modèle doit transmettre CE contenu, dans la langue du client.
    message_a_transmettre: MESSAGES[motif],
  }
}