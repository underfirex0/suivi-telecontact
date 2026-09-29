import { differenceInCalendarDays, differenceInMinutes, parseISO, addHours, addDays } from "date-fns";
import type { Dossier, DossierStatus, JuridiqueEtape, Edition, Societe } from "./types";

/**
 * Seuils métier :
 * - Référencement WEB Telecontact : effectif 24h EXACTES après la création du dossier
 * - QC en retard : 2 jours après le référencement (web) ou après la création (papier, Kompass)
 * - Suivi juridique : DÉCISION HUMAINE UNIQUEMENT — plus d'escalade automatique
 *   par nombre de jours. Une seule personne doit décider de l'activer.
 * - Niveaux de risque, cas général (web avec suivi de visibilité) : basés sur l'écart
 *   entre le % de visibilité consommée et le % payé.
 *   Niveau 1 = écart ≥ 20 points, Niveau 2 = écart ≥ 35, Niveau 3 = écart ≥ 50.
 * - Niveaux de risque, SANS suivi de visibilité (papier, Kompass internet) : basés
 *   sur l'ancienneté de la facture impayée — 15 jours / 25 jours / 90 jours.
 *   (Sans cette règle, ces dossiers n'escaladeraient jamais : il n'y a pas d'horloge
 *   de visibilité à comparer au montant payé.)
 * - Perte totale vs récupérable : uniquement quand une visibilité existe et est
 *   expirée. Moins de 10% payé → "perte totale"; au-delà → "perte partielle".
 * - PAPIER : la facture part quand l'annuaire sort en vente. Tant que la date de
 *   sortie de l'édition n'est pas atteinte → "En attente de parution". Dès qu'elle
 *   est atteinte et que le dossier n'est pas facturé → alerte "Annuaire sorti — à facturer".
 */
export const SEUIL_QC_RETARD_JOURS = 2;
export const SEUIL_NIVEAU_1_ECART_POINTS = 20;
export const SEUIL_NIVEAU_2_ECART_POINTS = 35;
export const SEUIL_NIVEAU_3_ECART_POINTS = 50;
export const SEUIL_JOURS_NIVEAU_1 = 15;
export const SEUIL_JOURS_NIVEAU_2 = 25;
export const SEUIL_JOURS_NIVEAU_3 = 90;
export const SEUIL_PERTE_TOTALE_PCT_PAYE = 10;
/** Après combien de jours de retard de facturation papier l'alerte passe en rouge. */
export const SEUIL_PAPIER_FACTURE_URGENTE_JOURS = 7;

/**
 * Contexte nécessaire à l'analyse : les éditions (pour la date de sortie de
 * l'annuaire papier). Paramètre OBLIGATOIRE de analyzeDossier — ainsi le compilateur
 * signale tout endroit qui l'oublierait (un oubli donnerait des statuts papier faux).
 */
export interface AnalyzeContext {
  editions: Edition[];
}

export const EMPTY_ANALYZE_CONTEXT: AnalyzeContext = { editions: [] };

export function findEdition(
  ctx: AnalyzeContext,
  societe: Societe,
  numero: number | null
): Edition | undefined {
  if (numero == null) return undefined;
  return ctx.editions.find((e) => e.societe === societe && e.numero === numero);
}

/** Le délai de 24h "référencement web" ne concerne que Telecontact Internet. */
export function usesReferencementDelay(d: Pick<Dossier, "societe" | "support">): boolean {
  return d.societe === "telecontact" && d.support === "internet";
}

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
    niveau: 0 as 0 | 1 | 2 | 3,
    niveauBase: null as "ecart" | "jours" | null,
    promesseRompue: false,
    rappelDu: false,
    joursSansAction,
  };
}

function promesseRompueDe(d: Dossier, now: Date, soldeDu: boolean): boolean {
  if (!soldeDu) return false;
  if (d.dernier_type_action !== "promesse_paiement") return false;
  if (!d.prochain_rappel) return false;
  return parseISO(d.prochain_rappel) < now;
}

/** Un rappel (tout type d'action confondu) était prévu aujourd'hui ou avant, et rien n'a été fait depuis. */
function rappelDuDe(d: Dossier, now: Date): boolean {
  if (!d.prochain_rappel) return false;
  const rappel = parseISO(d.prochain_rappel);
  return differenceInCalendarDays(now, rappel) >= 0;
}

/** Niveau 0-3 basé sur l'écart entre % temps consommé et % payé. */
export function niveauDe(gap: number | null): 0 | 1 | 2 | 3 {
  if (gap == null) return 0;
  if (gap >= SEUIL_NIVEAU_3_ECART_POINTS) return 3;
  if (gap >= SEUIL_NIVEAU_2_ECART_POINTS) return 2;
  if (gap >= SEUIL_NIVEAU_1_ECART_POINTS) return 1;
  return 0;
}

/** Niveau 0-3 basé sur l'ancienneté de la facture impayée (dossiers sans suivi de visibilité). */
export function niveauParJours(jours: number): 0 | 1 | 2 | 3 {
  if (jours >= SEUIL_JOURS_NIVEAU_3) return 3;
  if (jours >= SEUIL_JOURS_NIVEAU_2) return 2;
  if (jours >= SEUIL_JOURS_NIVEAU_1) return 1;
  return 0;
}

export function analyzeDossier(d: Dossier, now: Date, ctx: AnalyzeContext): DossierStatus {
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
    const web = usesReferencementDelay(d);
    const dateRef = web ? dateReferencement(d.created_at) : parseISO(d.created_at);
    // Hors web Telecontact il n'y a pas de délai de référencement : le dossier est "prêt" dès sa création.
    const referenced = web ? now >= dateRef : true;
    const origine = web ? "référencement" : "création";

    const daysSinceRef = referenced ? Math.max(0, differenceInCalendarDays(now, dateRef)) : 0;
    const late = referenced && daysSinceRef >= SEUIL_QC_RETARD_JOURS;

    if (d.qc_sous_statut === "a_corriger") {
      return {
        label: "À corriger",
        sub: !referenced
          ? "Référencement en cours · en attente de nouvelle vérification"
          : late
          ? `En retard · ${daysSinceRef}j depuis ${origine}`
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
        ? `En retard · ${daysSinceRef}j depuis ${origine}`
        : web
        ? "Référencé, prêt pour QC"
        : "Prêt pour QC",
      color: late ? "danger" : "neutral",
      alert: late,
      severity: late ? 3 : 0,
      columnKey: "qc",
      ...noVisibiliteFields(),
    };
  }

  if (d.etape === "facturation") {
    // --- PAPIER : la facture part quand l'annuaire sort en vente ---
    if (d.support === "papier") {
      const edition = findEdition(ctx, d.societe, d.edition);
      const sortie = edition?.date_sortie_annuaire ? parseISO(edition.date_sortie_annuaire) : null;

      if (!sortie) {
        return {
          label: "En attente de parution",
          sub: d.edition == null ? "Édition non renseignée" : "Date de sortie de l'annuaire non définie",
          color: "neutral",
          alert: false,
          severity: 0,
          columnKey: "facturation",
          ...noVisibiliteFields(),
        };
      }

      const jours = differenceInCalendarDays(now, sortie); // 0 = jour de sortie, > 0 = déjà sorti
      if (jours >= 0) {
        const urgent = jours >= SEUIL_PAPIER_FACTURE_URGENTE_JOURS;
        return {
          label: "Annuaire sorti — à facturer",
          sub: jours === 0 ? "Sorti aujourd'hui · facture à émettre" : `Sorti depuis ${jours}j · facture à émettre`,
          color: urgent ? "danger" : "warning",
          alert: true,
          severity: urgent ? 3 : 2,
          columnKey: "facturation",
          ...noVisibiliteFields(),
        };
      }
      return {
        label: "En attente de parution",
        sub: `Sortie de l'annuaire dans ${-jours}j`,
        color: "neutral",
        alert: false,
        severity: 0,
        columnKey: "facturation",
        ...noVisibiliteFields(),
      };
    }

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

    // --- Indicateurs de visibilité (uniquement si les DEUX dates existent) ---
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

    const gap = pctTemps !== null && pctPaye !== null ? pctTemps - pctPaye : null;
    const soldeDu = d.montant_facture != null && d.montant_recu < d.montant_facture;
    const perteReelle = pctTemps !== null && pctTemps >= 100 && soldeDu;
    const perteTotale = perteReelle && (pctPaye ?? 0) < SEUIL_PERTE_TOTALE_PCT_PAYE;

    // Base du niveau : écart temps/payé si une visibilité existe, sinon ancienneté en jours.
    const niveauBase: "ecart" | "jours" = pctTemps !== null ? "ecart" : "jours";
    const niveau: 0 | 1 | 2 | 3 =
      !perteReelle && soldeDu
        ? niveauBase === "ecart"
          ? niveauDe(gap)
          : niveauParJours(daysSinceFacture)
        : 0;
    const desyncRisque = niveau >= 1;
    const promesseRompue = !perteReelle && promesseRompueDe(d, now, soldeDu);
    const rappelDu = rappelDuDe(d, now);

    const niveauSub =
      niveauBase === "ecart"
        ? `${Math.round(pctTemps ?? 0)}% du temps consommé, ${Math.round(pctPaye ?? 0)}% payé — écart de ${Math.round(gap ?? 0)}pts`
        : `Impayé depuis ${daysSinceFacture}j — niveau selon l'ancienneté`;

    // --- Perte : priorité la plus haute, mais on distingue totale vs récupérable ---
    if (perteReelle) {
      if (perteTotale) {
        return {
          label: "Perte totale",
          sub: `Visibilité expirée (${Math.round(pctTemps!)}%) · ${Math.round(pctPaye ?? 0)}% payé — probablement irrécupérable`,
          color: "perte",
          alert: true,
          severity: 7,
          columnKey: "perte_totale",
          pctTemps,
          pctPaye,
          desyncRisque: false,
          niveau: 0,
          niveauBase: null,
          promesseRompue: false,
          rappelDu,
          joursSansAction,
        };
      }
      return {
        label: "Perte partielle — récupérable",
        sub: `Visibilité expirée (${Math.round(pctTemps!)}%) · ${Math.round(pctPaye ?? 0)}% payé — solde encore réclamable`,
        color: "danger",
        alert: true,
        severity: 6,
        columnKey: "perte_partielle",
        pctTemps,
        pctPaye,
        desyncRisque: false,
        niveau: 0,
        niveauBase: null,
        promesseRompue: false,
        rappelDu,
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
        severity: 5,
        columnKey: "juridique",
        pctTemps,
        pctPaye,
        desyncRisque,
        niveau,
        niveauBase,
        promesseRompue: false,
        rappelDu,
        joursSansAction,
      };
    }

    // --- Promesse de paiement non tenue : signal fort, prioritaire sur les niveaux génériques ---
    if (promesseRompue) {
      return {
        label: "Promesse non tenue",
        sub: `Devait payer le ${d.prochain_rappel} · rien reçu depuis`,
        color: "danger",
        alert: true,
        severity: 4,
        columnKey: "paiement",
        pctTemps,
        pctPaye,
        desyncRisque,
        niveau,
        niveauBase,
        promesseRompue: true,
        rappelDu,
        joursSansAction,
      };
    }

    // --- Niveaux 1/2/3 ---
    if (niveau === 3) {
      return {
        label: "Niveau 3",
        sub: niveauSub,
        color: "perte",
        alert: true,
        severity: 3.5,
        columnKey: "paiement",
        pctTemps,
        pctPaye,
        desyncRisque,
        niveau,
        niveauBase,
        promesseRompue: false,
        rappelDu,
        joursSansAction,
      };
    }
    if (niveau === 2) {
      return {
        label: "Niveau 2",
        sub: niveauSub,
        color: "danger",
        alert: true,
        severity: 3,
        columnKey: "paiement",
        pctTemps,
        pctPaye,
        desyncRisque,
        niveau,
        niveauBase,
        promesseRompue: false,
        rappelDu,
        joursSansAction,
      };
    }
    if (niveau === 1) {
      return {
        label: "Niveau 1",
        sub: niveauSub,
        color: "warning",
        alert: true,
        severity: 2,
        columnKey: "paiement",
        pctTemps,
        pctPaye,
        desyncRisque,
        niveau,
        niveauBase,
        promesseRompue: false,
        rappelDu,
        joursSansAction,
      };
    }

    // --- Rappel dû : aucun autre signal plus grave, mais un suivi était prévu et rien n'a été fait ---
    if (rappelDu) {
      const joursRetard = differenceInCalendarDays(now, parseISO(d.prochain_rappel!));
      return {
        label: "Rappel dû",
        sub: joursRetard === 0 ? "Rappel prévu aujourd'hui" : `Rappel en retard de ${joursRetard}j`,
        color: "warning",
        alert: true,
        severity: 1,
        columnKey: "paiement",
        pctTemps,
        pctPaye,
        desyncRisque,
        niveau,
        niveauBase,
        promesseRompue: false,
        rappelDu,
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
      niveau,
      niveauBase,
      promesseRompue: false,
      rappelDu,
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

export const JURIDIQUE_ETAPES: { key: JuridiqueEtape; label: string; color: DossierStatus["color"] }[] = [
  { key: "en_attente", label: "En attente", color: "neutral" },
  { key: "mise_en_demeure_edicom", label: "Mise en demeure Edicom", color: "warning" },
  { key: "mise_en_demeure_avocat", label: "Mise en demeure Avocat", color: "danger" },
  { key: "assignation", label: "Assignation déposée", color: "danger" },
  { key: "jugement", label: "Jugement obtenu", color: "juridique" },
  { key: "execution", label: "Exécution en cours", color: "juridique" },
  { key: "clos", label: "Clôturé", color: "success" },
];

export function juridiqueEtapeLabel(etape: JuridiqueEtape | null): string {
  return JURIDIQUE_ETAPES.find((e) => e.key === etape)?.label ?? "En attente";
}

export const COURRIEL_CONFIG: Record<1 | 2 | 3, { label: string; color: DossierStatus["color"] }> = {
  1: { label: "Courriel 1", color: "neutral" },
  2: { label: "Courriel 2", color: "warning" },
  3: { label: "Courriel 3", color: "danger" },
};
