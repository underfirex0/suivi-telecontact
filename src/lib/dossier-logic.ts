import { differenceInCalendarDays, differenceInMinutes, parseISO, addHours } from "date-fns";
import type { Dossier, DossierStatus } from "./types";

/**
 * Seuils métier (définis avec DG) :
 * - Référencement : effectif 24h EXACTES après la création du dossier
 *   (moment de la réception du BC signé dans le système), pas au prochain
 *   minuit calendaire — c'est un vrai délai de 24h, pas un jour calendaire.
 * - QC en retard : 2 jours après le référencement sans QC faite
 * - Relance niveau 1 : 15 jours après facturation sans paiement
 * - Relance niveau 2 : 25 jours après facturation sans paiement
 * - Suivi juridique (auto) : 3 mois (90 jours) après facturation sans paiement
 */
export const SEUIL_QC_RETARD_JOURS = 2;
export const SEUIL_RELANCE_1_JOURS = 15;
export const SEUIL_RELANCE_2_JOURS = 25;
export const SEUIL_JURIDIQUE_JOURS = 90;

/** Référencement = 24h exactes après la création du dossier (created_at). */
export function dateReferencement(createdAt: string): Date {
  return addHours(parseISO(createdAt), 24);
}

export function analyzeDossier(d: Dossier, now: Date = new Date()): DossierStatus {
  if (d.etape === "qc") {
    const dateRef = dateReferencement(d.created_at);
    const referenced = now >= dateRef;

    const daysSinceRef = referenced ? differenceInCalendarDays(now, dateRef) : 0;
    const late = referenced && daysSinceRef >= SEUIL_QC_RETARD_JOURS;

    if (d.qc_sous_statut === "a_corriger") {
      return {
        label: "À corriger",
        sub: !referenced
          ? "Référencement en cours · en attente de nouvelle vérification"
          : late
          ? `En retard · ${daysSinceRef}j depuis référencement`
          : "Corrections en cours",
        color: late ? "danger" : "warning",
        alert: late,
        severity: late ? 3 : 1,
        columnKey: "a_corriger",
      };
    }

    if (!referenced) {
      const minutesLeft = Math.max(0, differenceInMinutes(dateRef, now));
      const h = Math.floor(minutesLeft / 60);
      const m = minutesLeft % 60;
      return {
        label: "En attente de référencement",
        sub: `${h}h${String(m).padStart(2, "0")} restantes`,
        color: "neutral",
        alert: false,
        severity: 0,
        columnKey: "qc",
      };
    }

    return {
      label: "Contrôle qualité",
      sub: late
        ? `En retard · ${daysSinceRef}j depuis référencement`
        : "Référencé, prêt pour QC",
      color: late ? "danger" : "neutral",
      alert: late,
      severity: late ? 3 : 0,
      columnKey: "qc",
    };
  }

  if (d.etape === "facturation") {
    return {
      label: "Validé — à facturer",
      sub: "QC OK, en attente de facture",
      color: "success",
      alert: false,
      severity: 0,
      columnKey: "facturation",
    };
  }

  if (d.etape === "paiement") {
    const dateFacture = d.date_facture ? parseISO(d.date_facture) : now;
    const daysSinceFacture = differenceInCalendarDays(now, dateFacture);
    const juridiqueManuel = d.juridique_actif;

    if (juridiqueManuel || daysSinceFacture >= SEUIL_JURIDIQUE_JOURS) {
      return {
        label: "Suivi juridique",
        sub: `Impayé depuis ${daysSinceFacture}j`,
        color: "juridique",
        alert: true,
        severity: 4,
        columnKey: "juridique",
      };
    }
    if (daysSinceFacture >= SEUIL_RELANCE_2_JOURS) {
      return {
        label: "Relance niveau 2",
        sub: `Impayé depuis ${daysSinceFacture}j`,
        color: "danger",
        alert: true,
        severity: 3,
        columnKey: "paiement",
      };
    }
    if (daysSinceFacture >= SEUIL_RELANCE_1_JOURS) {
      return {
        label: "Relance niveau 1",
        sub: `Impayé depuis ${daysSinceFacture}j`,
        color: "warning",
        alert: true,
        severity: 2,
        columnKey: "paiement",
      };
    }
    return {
      label: "En attente de paiement",
      sub: `${daysSinceFacture}j depuis facture`,
      color: "neutral",
      alert: false,
      severity: 0,
      columnKey: "paiement",
    };
  }

  // paye
  return {
    label: "Payé",
    sub: d.date_paiement ? `Réglé le ${d.date_paiement}` : "Réglé",
    color: "success",
    alert: false,
    severity: 0,
    columnKey: "paye",
  };
}

export const KANBAN_COLUMNS: {
  key: DossierStatus["columnKey"];
  title: string;
  dot: DossierStatus["color"];
}[] = [
  { key: "qc", title: "Contrôle qualité", dot: "neutral" },
  { key: "a_corriger", title: "À corriger", dot: "warning" },
  { key: "facturation", title: "Validé — à facturer", dot: "success" },
  { key: "paiement", title: "Paiement", dot: "neutral" },
  { key: "juridique", title: "Suivi juridique", dot: "juridique" },
  { key: "paye", title: "Payé", dot: "success" },
];
