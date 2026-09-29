import type { Dossier, Societe, Support } from "./types";
import { SOCIETE_LABELS, SUPPORT_LABELS, editionTab } from "./tags";

/**
 * "Scope" = ce que l'utilisateur regarde : Société → Édition → Support.
 * Chaque dimension peut valoir "all" (tout voir). L'édition accepte aussi
 * "none" pour retrouver les dossiers non encore classés (sans édition) —
 * ainsi AUCUN dossier ne peut devenir introuvable.
 */
export type ScopeSociete = "all" | Societe;
export type ScopeEdition = "all" | "none" | number;
export type ScopeSupport = "all" | Support;

export interface Scope {
  societe: ScopeSociete;
  edition: ScopeEdition;
  support: ScopeSupport;
}

export const DEFAULT_SCOPE: Scope = { societe: "all", edition: "all", support: "all" };

export interface ScopeOptions {
  ignoreSociete?: boolean;
  ignoreEdition?: boolean;
  ignoreSupport?: boolean;
}

export function matchesScope(
  d: Pick<Dossier, "societe" | "support" | "edition">,
  scope: Scope,
  opts: ScopeOptions = {}
): boolean {
  if (!opts.ignoreSociete && scope.societe !== "all" && d.societe !== scope.societe) return false;
  if (!opts.ignoreSupport && scope.support !== "all" && d.support !== scope.support) return false;
  if (!opts.ignoreEdition) {
    if (scope.edition === "none") {
      if (d.edition != null) return false;
    } else if (scope.edition !== "all" && d.edition !== scope.edition) {
      return false;
    }
  }
  return true;
}

export function applyScope<T extends Pick<Dossier, "societe" | "support" | "edition">>(
  dossiers: T[],
  scope: Scope,
  opts: ScopeOptions = {}
): T[] {
  return dossiers.filter((d) => matchesScope(d, scope, opts));
}

export function isScopeFiltered(scope: Scope): boolean {
  return scope.societe !== "all" || scope.edition !== "all" || scope.support !== "all";
}

/** Libellé lisible, ex : "Telecontact · 36ème · Papier" ou "Toutes les sociétés". */
export function scopeLabel(scope: Scope): string {
  const parts: string[] = [];
  parts.push(scope.societe === "all" ? "Toutes les sociétés" : SOCIETE_LABELS[scope.societe]);
  if (scope.edition === "none") parts.push("Sans édition");
  else if (scope.edition !== "all") parts.push(editionTab(scope.edition));
  if (scope.support !== "all") parts.push(SUPPORT_LABELS[scope.support]);
  return parts.join(" · ");
}

/** Valide une valeur lue (ex : localStorage) — retombe sur le défaut si quoi que ce soit est invalide. */
export function sanitizeScope(raw: unknown): Scope {
  if (!raw || typeof raw !== "object") return DEFAULT_SCOPE;
  const r = raw as Record<string, unknown>;
  const societe: ScopeSociete =
    r.societe === "telecontact" || r.societe === "kompass" ? r.societe : "all";
  const support: ScopeSupport = r.support === "internet" || r.support === "papier" ? r.support : "all";
  let edition: ScopeEdition = "all";
  if (r.edition === "none") edition = "none";
  else if (typeof r.edition === "number" && Number.isInteger(r.edition)) edition = r.edition;
  // Une édition n'a de sens que pour une société précise
  if (societe === "all" && typeof edition === "number") edition = "all";
  return { societe, edition, support };
}
