export type Etape = "qc" | "facturation" | "paiement" | "paye";
export type QcSousStatut = "attente" | "a_corriger" | "ok";
export type ActionType = "appel" | "email" | "visite" | "promesse_paiement" | "autre";

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

  abandonne_at: string | null;
  abandonne_par: string | null;
  abandonne_raison: string | null;

  derniere_action_at: string | null;
  prochain_rappel: string | null;
  dernier_type_action: ActionType | null;

  juridique_actif: boolean;
  juridique_notes: string | null;

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
  note: string | null;
  date_rappel: string | null;
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
  desyncRisque: boolean; // écart important entre temps consommé et montant payé
  promesseRompue: boolean; // le client avait promis de payer avant une date passée, toujours rien reçu
  joursSansAction: number | null; // jours depuis la dernière action humaine enregistrée
}
