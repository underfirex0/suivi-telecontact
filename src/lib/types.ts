export type Etape = "qc" | "facturation" | "paiement" | "paye";
export type QcSousStatut = "attente" | "a_corriger" | "ok";

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
  date_paiement: string | null;

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

export type StatusColor =
  | "neutral"
  | "warning"
  | "danger"
  | "juridique"
  | "success";

export interface DossierStatus {
  label: string;
  sub: string;
  color: StatusColor;
  alert: boolean;
  severity: number; // 0 = calm, higher = more urgent
  columnKey: "qc" | "a_corriger" | "facturation" | "paiement" | "juridique" | "paye";
}
