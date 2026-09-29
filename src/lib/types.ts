import type { ImportDiff } from "./import-diff";

export type Etape = "qc" | "facturation" | "paiement" | "paye";
export type Societe = "telecontact" | "kompass";
export type Support = "internet" | "papier";
export type EditionStatut = "en_cours" | "terminee";
export type QcSousStatut = "attente" | "a_corriger" | "ok";
export type ActionType = "appel" | "email" | "visite" | "promesse_paiement" | "autre";
export type JuridiqueEtape =
  | "en_attente"
  | "mise_en_demeure_edicom"
  | "mise_en_demeure_avocat"
  | "assignation"
  | "jugement"
  | "execution"
  | "clos";

export interface Edition {
  id: string;
  societe: Societe;
  numero: number;
  statut: EditionStatut;
  date_sortie_annuaire: string | null; // papier : la facture part quand l'annuaire sort
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  created_at: string;
}

export interface Dossier {
  id: string;
  client_nom: string;
  offre: string | null;
  contact_client: string | null;
  commercial: string | null;
  date_bc: string; // ISO date (yyyy-mm-dd)

  etape: Etape;
  qc_sous_statut: QcSousStatut;
  date_qc: string | null;

  date_facture: string | null;
  montant_facture: number | null;
  montant_recu: number;
  date_paiement: string | null;

  date_debut_visibilite: string | null;
  date_fin_visibilite: string | null;

  numero_facture: string | null;
  ville: string | null;
  courriel_niveau: 1 | 2 | 3 | null;

  societe: Societe;
  support: Support;
  edition: number | null;
  ordre: string | null;
  code_firme: string | null;

  abandonne_at: string | null;
  abandonne_par: string | null;
  abandonne_raison: string | null;

  derniere_action_at: string | null;
  prochain_rappel: string | null;
  dernier_type_action: ActionType | null;

  juridique_actif: boolean;
  juridique_notes: string | null;
  juridique_etape: JuridiqueEtape | null;
  juridique_etape_maj_at: string | null;
  date_mise_en_demeure: string | null;
  date_mise_en_demeure_avocat: string | null;
  date_assignation: string | null;
  date_jugement: string | null;
  montant_jugement: number | null;
  avocat_referent: string | null;
  reference_tribunal: string | null;

  archived_at: string | null;
  archived_by: string | null;

  notes: string | null;
  operateur_id: string | null;
  created_by: string | null;

  created_at: string;
  updated_at: string;
}

export interface HistoriqueEntry {
  id: string;
  dossier_id: string;
  auteur_id: string | null;
  texte: string;
  created_at: string;
}

export interface Paiement {
  id: string;
  dossier_id: string;
  montant: number;
  date_paiement: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ActionEntry {
  id: string;
  dossier_id: string;
  type: ActionType;
  resultat: string | null;
  sous_statut: string | null;
  note: string | null;
  date_rappel: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ImportBatch {
  id: string;
  libelle: string;
  fichiers: string[];
  nb_nouveaux_dossiers: number;
  nb_dossiers_soldes: number;
  nb_dossiers_partiels: number;
  montant_total_regle: number;
  detail: ImportDiff;
  created_by: string | null;
  created_at: string;
}
export type StatusColor =
  | "neutral"
  | "warning"
  | "danger"
  | "juridique"
  | "success"
  | "perte";

export type ColumnKey =
  | "qc"
  | "a_corriger"
  | "facturation"
  | "paiement"
  | "juridique"
  | "perte_totale"
  | "perte_partielle"
  | "abandonne"
  | "paye";

export interface DossierStatus {
  label: string;
  sub: string;
  color: StatusColor;
  alert: boolean;
  severity: number; // 0 = calme, plus haut = plus urgent
  columnKey: ColumnKey;
  // Indicateurs de visibilité (uniquement calculés si les dates de visibilité existent)
  pctTemps: number | null; // % du temps de visibilité déjà consommé
  pctPaye: number | null; // % du montant facturé déjà réglé
  desyncRisque: boolean; // niveau >= 1 (conservé pour compatibilité d'affichage)
  niveau: 0 | 1 | 2 | 3; // niveau de risque (écart temps/payé, ou ancienneté en jours si pas de visibilité)
  niveauBase: "ecart" | "jours" | null; // sur quelle base le niveau est calculé
  promesseRompue: boolean; // le client avait promis de payer avant une date passée, toujours rien reçu
  rappelDu: boolean; // un rappel était prévu aujourd'hui ou avant, toujours pas traité
  joursSansAction: number | null; // jours depuis la dernière action humaine enregistrée
}
