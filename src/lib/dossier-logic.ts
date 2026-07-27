import { differenceInCalendarDays, differenceInMinutes, parseISO, addHours, addDays } from "date-fns";
import type { Dossier, DossierStatus } from "./types";

/**
 * Seuils métier (définis avec DG) :
 * - Référencement : effectif 24h EXACTES après la création du dossier
 * - QC en retard : 2 jours après le référencement sans QC faite
 * - Relance niveau 1 : 15 jours après facturation sans paiement
 * - Relance niveau 2 : 25 jours après facturation sans paiement
 * - Suivi juridique (auto) : 3 mois (90 jours) après facturation sans paiement
 *
 * Seuil ajouté (proposé par défaut, à ajuster si besoin — voir SEUIL_DESYNC_ECART_POINTS) :
 * - Risque de désynchronisation : le % de visibilité déjà consommée dépasse le
 *   % déjà payé de 25 points ou plus, AVANT que la visibilité expire totalement.
 *   Objectif : agir (relancer / menacer de couper la visibilité) pendant qu'il
 *   reste encore un levier de négociation — une fois à 100% de temps consommé
 *   sans solde, il n'y a plus aucun levier : c'est une perte réelle.
 */
export const SEUIL_QC_RETARD_JOURS = 2;
export const SEUIL_RELANCE_1_JOURS = 15;
export const SEUIL_RELANCE_2_JOURS = 25;
export const SEUIL_JURIDIQUE_JOURS = 90;
export const SEUIL_DESYNC_ECART_POINTS = 25;

/** Référencement = 24h exactes après la création du dossier (created_at). */
export function dateReferencement(createdAt: string): Date {
  return addHours(parseISO(createdAt), 24);
}

/** Fin de visibilité par défaut pour un nouveau dossier = 365 jours après le début. */
export function dateFinVisibiliteParDefaut(dateDebut: Date): Date {
  return addDays(dateDebut, 365);
}

function noVisibiliteFields() {
  return { pctTemps: null as number | null, pctPaye: null as number | null, desyncRisque: false };
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
        ...noVisibiliteFields(),
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
        ...noVisibiliteFields(),
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
      ...noVisibiliteFields(),
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
      ...noVisibiliteFields(),
    };
  }

  if (d.etape === "paiement") {
    const dateFacture = d.date_facture ? parseISO(d.date_facture) : now;
    const daysSinceFacture = differenceInCalendarDays(now, dateFacture);
    const juridiqueManuel = d.juridique_actif;

    // --- Indicateurs de visibilité (uniquement si les dates existent) ---
    let pctTemps: number | null = null;
    if (d.date_debut_visibilite && d.date_fin_visibilite) {
      const debut = parseISO(d.date_debut_visibilite);
      const fin = parseISO(d.date_fin_visibilite);
      const totalJours = differenceInCalendarDays(fin, debut);
      const joursEcoules = differenceInCalendarDays(now, debut);
      pctTemps = totalJours > 0 ? Math.max(0, (joursEcoules / totalJours) * 100) : null;
    }

    let pctPaye: number | null = null;
    if (d.montant_facture && d.montant_facture > 0) {
      pctPaye = Math.max(0, (d.montant_recu / d.montant_facture) * 100);
    }

    const soldeDu = d.montant_facture != null && d.montant_recu < d.montant_facture;
    const perteReelle = pctTemps !== null && pctTemps >= 100 && soldeDu;
    const desyncRisque =
      !perteReelle &&
      pctTemps !== null &&
      pctPaye !== null &&
      soldeDu &&
      pctTemps - pctPaye >= SEUIL_DESYNC_ECART_POINTS;

    // --- Perte réelle : priorité absolue, pire cas possible ---
    if (perteReelle) {
      return {
        label: "Perte réelle",
        sub: `Visibilité expirée (${Math.round(pctTemps!)}%) · ${Math.round(pctPaye ?? 0)}% payé seulement`,
        color: "perte",
        alert: true,
        severity: 5,
        columnKey: "perte",
        pctTemps,
        pctPaye,
        desyncRisque: false,
      };
    }

    if (juridiqueManuel || daysSinceFacture >= SEUIL_JURIDIQUE_JOURS) {
      return {
        label: "Suivi juridique",
        sub: `Impayé depuis ${daysSinceFacture}j`,
        color: "juridique",
        alert: true,
        severity: 4,
        columnKey: "juridique",
        pctTemps,
        pctPaye,
        desyncRisque,
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
        pctTemps,
        pctPaye,
        desyncRisque,
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
        pctTemps,
        pctPaye,
        desyncRisque,
      };
    }

    if (desyncRisque) {
      return {
        label: "Risque de désynchronisation",
        sub: `${Math.round(pctTemps!)}% du temps consommé, ${Math.round(pctPaye!)}% payé seulement`,
        color: "warning",
        alert: true,
        severity: 3,
        columnKey: "paiement",
        pctTemps,
        pctPaye,
        desyncRisque,
      };
    }

    return {
      label: "En attente de paiement",
      sub: `${daysSinceFacture}j depuis facture`,
      color: "neutral",
      alert: false,
      severity: 0,
      columnKey: "paiement",
      pctTemps,
      pctPaye,
      desyncRisque,
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
    ...noVisibiliteFields(),
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
  { key: "perte", title: "Perte réelle", dot: "perte" },
  { key: "paye", title: "Payé", dot: "success" },
];
