"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SCOPE,
  applyScope,
  sanitizeScope,
  type Scope,
  type ScopeEdition,
  type ScopeOptions,
  type ScopeSociete,
  type ScopeSupport,
} from "@/lib/scope";
import type { Dossier } from "@/lib/types";

const STORAGE_KEY = "suivi-scope-v1";

interface ScopeContextValue {
  scope: Scope;
  ready: boolean;
  setSociete: (s: ScopeSociete) => void;
  setEdition: (e: ScopeEdition) => void;
  setSupport: (s: ScopeSupport) => void;
  reset: () => void;
  /** Filtre une liste de dossiers selon la sélection courante. */
  apply: <T extends Pick<Dossier, "societe" | "support" | "edition">>(list: T[], opts?: ScopeOptions) => T[];
}

const ScopeContext = createContext<ScopeContextValue | null>(null);

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScope] = useState<Scope>(DEFAULT_SCOPE);
  const [ready, setReady] = useState(false);

  // Lecture de la dernière sélection (après montage, pour ne pas désynchroniser le rendu serveur).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setScope(sanitizeScope(JSON.parse(raw)));
    } catch {
      // stockage indisponible ou contenu corrompu : on garde la sélection par défaut
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scope));
    } catch {
      // ignoré : la sélection ne sera simplement pas mémorisée
    }
  }, [scope, ready]);

  // Changer de société remet l'édition à "toutes" : une édition n'a de sens que dans sa société.
  const setSociete = useCallback((societe: ScopeSociete) => {
    setScope((prev) => (prev.societe === societe ? prev : { ...prev, societe, edition: "all" }));
  }, []);
  const setEdition = useCallback((edition: ScopeEdition) => setScope((prev) => ({ ...prev, edition })), []);
  const setSupport = useCallback((support: ScopeSupport) => setScope((prev) => ({ ...prev, support })), []);
  const reset = useCallback(() => setScope(DEFAULT_SCOPE), []);

  const apply = useCallback(
    <T extends Pick<Dossier, "societe" | "support" | "edition">>(list: T[], opts?: ScopeOptions) =>
      applyScope(list, scope, opts),
    [scope]
  );

  const value = useMemo(
    () => ({ scope, ready, setSociete, setEdition, setSupport, reset, apply }),
    [scope, ready, setSociete, setEdition, setSupport, reset, apply]
  );

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("useScope doit être utilisé dans <ScopeProvider>");
  return ctx;
}
