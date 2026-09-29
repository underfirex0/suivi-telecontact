import type { Societe, Support } from "./types";

/**
 * Définitions partagées des "tags" d'un dossier : société, support, édition.
 * Un seul endroit → l'application entière affiche les mêmes libellés/couleurs.
 */

export const SOCIETES: { key: Societe; label: string; short: string; color: string }[] = [
  { key: "telecontact", label: "Telecontact", short: "TLC", color: "#0E7C7B" },
  { key: "kompass", label: "Kompass", short: "KMP", color: "#2B5FD9" },
];

export const SOCIETE_LABELS: Record<Societe, string> = {
  telecontact: "Telecontact",
  kompass: "Kompass",
};

export const SOCIETE_SHORT: Record<Societe, string> = {
  telecontact: "TLC",
  kompass: "KMP",
};

export const SOCIETE_COLORS: Record<Societe, string> = {
  telecontact: "#0E7C7B",
  kompass: "#2B5FD9",
};

export const SUPPORTS: { key: Support; label: string }[] = [
  { key: "internet", label: "Internet" },
  { key: "papier", label: "Papier" },
];

export const SUPPORT_LABELS: Record<Support, string> = {
  internet: "Internet",
  papier: "Papier",
};

/** "36" → "36ème" (libellé des onglets d'édition) */
export function editionTab(numero: number): string {
  return `${numero}ème`;
}

/** "36" → "Éd. 36" (petit badge sur une carte) */
export function editionBadge(numero: number | null | undefined): string {
  return numero == null ? "Sans édition" : `Éd. ${numero}`;
}

// ---------------------------------------------------------------------------
// Codes utilisés dans les fichiers Excel sources
//   STE  : 3 = Telecontact, 1 = Kompass
//   S    : 1 = Papier, 2 = Internet Telecontact, 4 = Internet Kompass
//   N° E : numéro d'édition
// ---------------------------------------------------------------------------

/** Société d'un dossier d'après la colonne STE. `null` si le code est inconnu. */
export function societeFromSte(ste: number | null | undefined): Societe | null {
  if (ste === 3) return "telecontact";
  if (ste === 1) return "kompass";
  return null;
}

/** Support d'après la colonne S (ou TEDI / Sup) : 1 = papier, tout le reste = internet. */
export function supportFromCode(code: number | null | undefined): Support {
  return code === 1 ? "papier" : "internet";
}

/** Codes support connus — un autre code est signalé comme anomalie (mais traité comme Internet). */
export function isKnownSupportCode(code: number | null | undefined): boolean {
  return code === 1 || code === 2 || code === 4;
}

/** Fichier des impayés : Ste 3 / 1 connus, tout autre code (ex : 6) devient "autre". */
export function impayeSocieteFromSte(ste: number | null | undefined): Societe | "autre" {
  return societeFromSte(ste) ?? "autre";
}

/** Type d'impayé (colonne Type) — libellés supposés, à confirmer : F = Facture, C = Chèque. */
export const IMPAYE_TYPE_LABELS: Record<string, string> = {
  F: "Facture",
  C: "Chèque",
};

export function impayeTypeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return IMPAYE_TYPE_LABELS[type] ?? type;
}
