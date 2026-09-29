import type { Societe, Support } from "./types";
import type { ImpayeRow, ParsedFile } from "./import-parser";

/**
 * Module Impayés — un impayé est un incident de paiement individuel (facture ou chèque),
 * identifié par le numéro de "Dossier" du fichier source. Indépendant des dossiers de
 * référencement : ses montants ne sont JAMAIS additionnés à ceux des dossiers.
 *
 * Qui possède quoi après le premier import :
 *  - le FICHIER fait foi pour l'argent et l'identité (montants, client, ville, type, dates, tags)
 *  - l'APPLICATION fait foi pour le traitement (agent, appels, visites, rappel, courrier, notes, statut)
 *    → un nouvel import ne les écrase jamais.
 */

export type ImpayeStatut = "ouvert" | "solde" | "clos";
export type ImpayeActionType = "appel" | "visite" | "courrier" | "promesse" | "autre" | "systeme";

export interface Impaye {
  id: string;
  numero_dossier: string;
  agent: string | null;
  ste_code: number | null;
  societe: Societe | "autre";
  sup_code: number | null;
  support: Support;
  edition: number | null;
  ordre: string | null;
  code_firme: string | null;
  client_nom: string;
  ville: string | null;
  commercial: string | null;
  type: string | null;
  montant_impaye: number;
  montant_recu: number;
  reste: number;
  date_impaye: string | null;
  date_rappel: string | null;
  nbre_appel: number;
  nbre_visite: number;
  date_prochaine_visite: string | null;
  courrier: string | null;
  statut: ImpayeStatut;
  raison_cloture: string | null;
  derniere_action_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImpayeAction {
  id: string;
  impaye_id: string;
  type: ImpayeActionType;
  resultat: string | null;
  note: string | null;
  date_rappel: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ImpayeChamp {
  champ: string;
  cle: string;
  ancien: string;
  nouveau: string;
  valeur: string | number | null;
}

export interface ImpayeMiseAJour {
  impayeId: string;
  numeroDossier: string;
  client: string;
  champs: ImpayeChamp[];
}

export interface ImpayeAbsent {
  impayeId: string;
  numeroDossier: string;
  client: string;
  reste: number;
  agent: string | null;
}

export interface ImpayesDiff {
  nouveaux: ImpayeRow[];
  misesAJour: ImpayeMiseAJour[];
  absents: ImpayeAbsent[];
  anomalies: { ligne: string; raison: string }[];
}

export interface ImpayeImportBatch {
  id: string;
  libelle: string;
  fichier: string | null;
  nb_nouveaux: number;
  nb_mises_a_jour: number;
  nb_soldes: number;
  montant_reste_total: number;
  detail: ImpayesDiff;
  created_by: string | null;
  created_at: string;
}

export const TOLERANCE = 0.01;

const fmt = (n: number) => `${n.toLocaleString("fr-FR")} MAD`;

/** Champs dont le FICHIER fait foi (comparés à chaque import). */
const CHAMPS_FICHIER: {
  cle: keyof Impaye & string;
  champ: string;
  get: (r: ImpayeRow) => string | number | null;
  numeric?: boolean;
}[] = [
  { cle: "montant_impaye", champ: "Montant impayé", get: (r) => r.montantImpaye, numeric: true },
  { cle: "montant_recu", champ: "Déjà réglé", get: (r) => r.montantRecu, numeric: true },
  { cle: "reste", champ: "Reste dû", get: (r) => r.reste, numeric: true },
  { cle: "client_nom", champ: "Client", get: (r) => r.client },
  { cle: "ville", champ: "Ville", get: (r) => r.ville },
  { cle: "type", champ: "Type", get: (r) => r.type },
  { cle: "date_impaye", champ: "Date de l'impayé", get: (r) => r.dateImpaye },
  { cle: "ordre", champ: "N° d'ordre", get: (r) => r.ordre },
  { cle: "code_firme", champ: "Code firme", get: (r) => r.codeFirme },
  { cle: "commercial", champ: "Commercial", get: (r) => r.commercial },
  { cle: "edition", champ: "Édition", get: (r) => r.edition },
];

function sameValue(a: unknown, b: unknown, numeric?: boolean): boolean {
  if (numeric) return Math.abs(Number(a ?? 0) - Number(b ?? 0)) <= TOLERANCE;
  return (a ?? null) === (b ?? null);
}

function show(v: unknown, numeric?: boolean): string {
  if (v == null || v === "") return "—";
  return numeric ? fmt(Number(v)) : String(v);
}

export function computeImpayesDiff(files: ParsedFile[], existing: Impaye[]): ImpayesDiff {
  const anomalies: { ligne: string; raison: string }[] = [];
  const rows = new Map<string, ImpayeRow>();

  for (const f of files) {
    if (f.kind !== "impayes") {
      anomalies.push({
        ligne: f.filename,
        raison:
          f.kind === "inconnu"
            ? "Format de fichier non reconnu — ce n'est pas un fichier d'impayés."
            : "Ce fichier n'est pas un fichier d'impayés — à importer depuis la page « Import ». Ignoré.",
      });
      continue;
    }
    let doublons = 0;
    for (const r of f.impayeRows) {
      if (rows.has(r.numeroDossier)) doublons++;
      rows.set(r.numeroDossier, r); // le dernier gagne
    }
    if (doublons > 0)
      anomalies.push({ ligne: f.filename, raison: `${doublons} n° de dossier en double dans le fichier — la dernière ligne est retenue.` });
    const societesInconnues = f.impayeRows.filter((r) => r.societe === "autre").length;
    if (societesInconnues > 0) {
      const codes = Array.from(new Set(f.impayeRows.filter((r) => r.societe === "autre").map((r) => r.steCode)));
      anomalies.push({
        ligne: f.filename,
        raison: `${societesInconnues} impayé(s) d'une société inconnue (code Ste ${codes.join(", ")}) — importés comme « Autre société ».`,
      });
    }
  }

  const existingByNumero = new Map(existing.map((i) => [i.numero_dossier, i]));
  const nouveaux: ImpayeRow[] = [];
  const misesAJour: ImpayeMiseAJour[] = [];

  for (const row of rows.values()) {
    const ex = existingByNumero.get(row.numeroDossier);
    if (!ex) {
      nouveaux.push(row);
      continue;
    }
    const champs: ImpayeChamp[] = [];
    for (const c of CHAMPS_FICHIER) {
      const nouveau = c.get(row);
      const ancien = (ex as unknown as Record<string, unknown>)[c.cle];
      // On n'efface jamais une valeur existante avec une cellule vide du fichier.
      if ((nouveau == null || nouveau === "") && !c.numeric) continue;
      if (!sameValue(ancien, nouveau, c.numeric)) {
        champs.push({
          champ: c.champ,
          cle: c.cle,
          ancien: show(ancien, c.numeric),
          nouveau: show(nouveau, c.numeric),
          valeur: nouveau,
        });
      }
    }
    // Statut dérivé de l'argent
    if (ex.statut === "ouvert" && row.reste <= TOLERANCE) {
      champs.push({ champ: "Statut", cle: "statut", ancien: "Ouvert", nouveau: "Soldé", valeur: "solde" });
    } else if (ex.statut === "solde" && row.reste > TOLERANCE) {
      champs.push({ champ: "Statut", cle: "statut", ancien: "Soldé", nouveau: "Ouvert (réapparu dans le fichier)", valeur: "ouvert" });
    }
    if (champs.length > 0) {
      misesAJour.push({ impayeId: ex.id, numeroDossier: ex.numero_dossier, client: ex.client_nom, champs });
    }
  }

  // Le fichier est un instantané complet du portefeuille : un impayé ouvert qui n'y figure plus est vraisemblablement réglé.
  const absents: ImpayeAbsent[] = existing
    .filter((i) => i.statut === "ouvert" && !rows.has(i.numero_dossier))
    .map((i) => ({ impayeId: i.id, numeroDossier: i.numero_dossier, client: i.client_nom, reste: i.reste, agent: i.agent }));

  nouveaux.sort((a, b) => b.reste - a.reste);
  return { nouveaux, misesAJour, absents, anomalies };
}

export function impayesDiffKpis(diff: ImpayesDiff) {
  return {
    nbNouveaux: diff.nouveaux.length,
    montantNouveaux: diff.nouveaux.reduce((s, r) => s + r.reste, 0),
    nbMisesAJour: diff.misesAJour.length,
    nbAbsents: diff.absents.length,
    montantAbsents: diff.absents.reduce((s, a) => s + a.reste, 0),
    nbSoldesParFichier: diff.misesAJour.filter((m) => m.champs.some((c) => c.cle === "statut" && c.valeur === "solde")).length,
  };
}

/** Indicateurs du portefeuille d'impayés ouverts. */
export function impayesPortfolioKpis(impayes: Impaye[], today: string) {
  const ouverts = impayes.filter((i) => i.statut === "ouvert");
  const resteTotal = ouverts.reduce((s, i) => s + i.reste, 0);
  const rappelsDus = ouverts.filter((i) => i.date_rappel && i.date_rappel <= today).length;
  const plusAncien = ouverts.map((i) => i.date_impaye).filter((d): d is string => !!d).sort()[0] ?? null;
  const parAgent = new Map<string, { nb: number; reste: number }>();
  ouverts.forEach((i) => {
    const k = i.agent ?? "Non affecté";
    const cur = parAgent.get(k) ?? { nb: 0, reste: 0 };
    cur.nb += 1;
    cur.reste += i.reste;
    parAgent.set(k, cur);
  });
  return {
    nbOuverts: ouverts.length,
    resteTotal,
    rappelsDus,
    plusAncien,
    parAgent: Array.from(parAgent.entries())
      .map(([agent, v]) => ({ agent, ...v }))
      .sort((a, b) => b.reste - a.reste),
  };
}
