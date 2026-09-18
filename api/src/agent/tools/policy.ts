

export const REMISE_MAX_PCT = 0.10          
export const RETOUR_JOURS   = 7
export const GARANTIE_JOURS = 30

export const MOTIFS_ESCALADE = [
  'facturation_societe',
  'reclamation_litige',
  'hors_catalogue',
  'ville_hors_grille',
  'remise_sous_plancher',
  'remboursement_especes',
] as const

export type MotifEscalade = typeof MOTIFS_ESCALADE[number]


export const INTERDITS = {
  promettreReassort: true,   
  estimerLivraison: true,    
  prixHorsCatalogue: true,
}