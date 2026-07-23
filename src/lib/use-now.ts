"use client";

import { useEffect, useState } from "react";

/**
 * Renvoie l'heure actuelle et la met à jour toutes les `intervalMs` millisecondes.
 * Permet aux statuts calculés (analyzeDossier) de se rafraîchir tout seuls,
 * sans attendre une navigation ou une mise à jour en temps réel d'un collègue.
 */
export function useNow(intervalMs: number = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
