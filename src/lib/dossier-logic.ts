import { differenceInCalendarDays, differenceInMinutes, parseISO, addHours, addDays } from "date-fns";
import type { Dossier, DossierStatus } from "./types";

/**
 * Seuils métier :
 * - Référencement : effectif 24h EXACTES après la création du dossier
 * - QC en retard : 2 jours après le référencement sans QC faite
 * - Relance niveau 1 : 15 jours après facturation sans paiement
 * - Relance niveau 2 : 25 jours après facturation sans paiement
 * - Suivi juridique : DÉCISION HUMAINE UNIQUEMENT — plus d'escalade automatique
 *   par nombre de jours. Une seule personne doit décider de l'activer.
 * - Risque de désynchronisation : le % de visibilité consommée dépasse le %
 *   payé de 25 points ou plus, avant expiration totale (seuil par défaut,
 *   ajustable — voir SEUIL_DESYNC_ECART_POINTS).
 * - Perte totale vs récupérable : si moins de 10% du montant facturé a été
 *   réglé au moment où la visibilité expire, on considère que le dossier
 *   n'a jamais vraiment généré de paiement ("perte totale" — probablement
 *   irrécupérable). Au-delà de 10%, un vrai montant reste en jeu
 *   ("perte partielle récupérable" — encore à réclamer).
 */
export const SEUIL_QC_RETARD_JOURS = 2;
export const SEUIL_RELANCE_1_JOURS = 15;
export const SEUIL_RELANCE_2_JOURS = 25;
export const SEUIL_DESYNC_ECART_POINTS = 25;
export const SEUIL_PERTE_TOTALE_PCT_PAYE = 10;

/** Référencement = 24h exactes après la création du dossier (created_at). */
export function dateReferencement(createdAt: string): Date {
  return addHours(parseISO(createdAt), 24);
}

/** Fin de visibilité par défaut pour un nouveau dossier = 365 jours après le début. */
export function dateFinVisibiliteParDefaut(dateDebut: Date): Date {
  return addDays(dateDebut, 365);
}

function joursSansActionDe(d: Dossier, now: Date): number {
  const derniereActivite = d.derniere_action_at ? parseISO(d.derniere_action_at) : parseISO(d.created_at);
  return Math.max(0, differenceInCalendarDays(now, derniereActivite));
}

function noVisibiliteFields(joursSansAction: number | null = null) {
  return {
    pctTemps: null as number | null,
    pctPaye: null as number | null,
    desyncRisque: false,
    joursSansAction,
  };
}

export function analyzeDossier(d: Dossier, now: Date = new Date()): DossierStatus {
  // --- Abandon explicite : prioritaire sur tout, un humain a décidé d'arrêter ---
  if (d.abandonne_at) {
    return {
      label: "Abandonné",
      sub: `Abandonné le ${d.abandonne_at.slice(0, 10)}`,
      color: "neutral",
      alert: false,
      severity: -1,
      columnKey: "abandonne",
      ...noVisibiliteFields(joursSansActionDe(d, now)),
    };
  }

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
    const joursSansAction = joursSansActionDe(d, now);

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
    const perteTotale = perteReelle && (pctPaye ?? 0) < SEUIL_PERTE_TOTALE_PCT_PAYE;
    const desyncRisque =
      !perteReelle &&
      pctTemps !== null &&
      pctPaye !== null &&
      soldeDu &&
      pctTemps - pctPaye >= SEUIL_DESYNC_ECART_POINTS;

    // --- Perte : priorité la plus haute, mais on distingue totale vs récupérable ---
    if (perteReelle) {
      if (perteTotale) {
        return {
          label: "Perte totale",
          sub: `Visibilité expirée (${Math.round(pctTemps!)}%) · ${Math.round(pctPaye ?? 0)}% payé — probablement irrécupérable`,
          color: "perte",
          alert: true,
          severity: 6,
          columnKey: "perte_totale",
          pctTemps,
          pctPaye,
          desyncRisque: false,
          joursSansAction,
        };
      }
      return {
        label: "Perte partielle — récupérable",
        sub: `Visibilité expirée (${Math.round(pctTemps!)}%) · ${Math.round(pctPaye ?? 0)}% payé — solde encore réclamable`,
        color: "danger",
        alert: true,
        severity: 5,
        columnKey: "perte_partielle",
        pctTemps,
        pctPaye,
        desyncRisque: false,
        joursSansAction,
      };
    }

    // --- Suivi juridique : DÉCISION MANUELLE UNIQUEMENT, plus d'auto par jours ---
    if (d.juridique_actif) {
      return {
        label: "Suivi juridique",
        sub: `Impayé depuis ${daysSinceFacture}j · décision manuelle`,
        color: "juridique",
        alert: true,
        severity: 4,
        columnKey: "juridique",
        pctTemps,
        pctPaye,
        desyncRisque,
        joursSansAction,
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
        joursSansAction,
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
        joursSansAction,
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
        joursSansAction,
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
      joursSansAction,
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

/**
 * Score de priorité pour la File d'action — combine sévérité, montant en jeu
 * et jours sans action humaine. La sévérité domine le tri (un cas plus grave
 * passe toujours avant), puis à sévérité égale, l'ancienneté sans action et
 * le montant départagent. Formule volontairement simple et documentée ici ;
 * à ajuster si l'ordre obtenu ne reflète pas la réalité du terrain.
 */
export function scoreFileAction(d: Dossier, status: DossierStatus): number {
  const montantReste = d.montant_facture != null ? Math.max(0, d.montant_facture - d.montant_recu) : 0;
  const jours = Math.min(status.joursSansAction ?? 0, 180);
  return status.severity * 1_000_000 + jours * 1_000 + Math.min(montantReste, 999_000);
}

// Kanban = uniquement le pipeline "front" (avant facturation). Le suivi de
// paiement/relances/pertes/juridique vit désormais dans la File d'action.
export const KANBAN_COLUMNS: {
  key: DossierStatus["columnKey"];
  title: string;
  dot: DossierStatus["color"];
}[] = [
  { key: "qc", title: "Contrôle qualité", dot: "neutral" },
  { key: "a_corriger", title: "À corriger", dot: "warning" },
  { key: "facturation", title: "Validé — à facturer", dot: "success" },
  { key: "paye", title: "Payé", dot: "success" },
];
