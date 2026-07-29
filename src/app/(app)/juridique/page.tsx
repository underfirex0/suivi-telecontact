"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, X } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { JURIDIQUE_ETAPES, juridiqueEtapeLabel } from "@/lib/dossier-logic";
import { useNow } from "@/lib/use-now";
import { formatMontant, formatDate, cn } from "@/lib/utils";
import type { JuridiqueEtape } from "@/lib/types";
import { differenceInCalendarDays, parseISO } from "date-fns";

type SortMode = "anciennete" | "montant" | "client";

export default function JuridiquePage() {
  const { dossiers, toggleJuridique, updateJuridiqueEtape } = useDossiers();
  const router = useRouter();
  const now = useNow();

  const [etapeFilter, setEtapeFilter] = useState<string>("actifs");
  const [avocatFilter, setAvocatFilter] = useState("all");
  const [villeFilter, setVilleFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("anciennete");

  const enJuridique = useMemo(
    () => dossiers.filter((d) => d.juridique_actif && !d.archived_at && !d.abandonne_at),
    [dossiers]
  );

  const avocats = useMemo(() => {
    const set = new Set<string>();
    enJuridique.forEach((d) => d.avocat_referent && set.add(d.avocat_referent));
    return Array.from(set).sort();
  }, [enJuridique]);

  const villes = useMemo(() => {
    const set = new Set<string>();
    enJuridique.forEach((d) => d.ville && set.add(d.ville));
    return Array.from(set).sort();
  }, [enJuridique]);

  const filtered = useMemo(() => {
    let list = enJuridique.filter((d) => {
      const etape = d.juridique_etape ?? "mise_en_demeure";
      if (etapeFilter === "actifs" && etape === "clos") return false;
      if (etapeFilter !== "all" && etapeFilter !== "actifs" && etape !== etapeFilter) return false;
      if (avocatFilter !== "all" && d.avocat_referent !== avocatFilter) return false;
      if (villeFilter !== "all" && d.ville !== villeFilter) return false;
      return true;
    });

    list = list.sort((a, b) => {
      if (sortMode === "montant") {
        return (b.montant_facture ?? 0) - b.montant_recu - ((a.montant_facture ?? 0) - a.montant_recu);
      }
      if (sortMode === "client") {
        return a.client_nom.localeCompare(b.client_nom);
      }
      const joursA = a.juridique_etape_maj_at
        ? differenceInCalendarDays(now, parseISO(a.juridique_etape_maj_at))
        : 0;
      const joursB = b.juridique_etape_maj_at
        ? differenceInCalendarDays(now, parseISO(b.juridique_etape_maj_at))
        : 0;
      return joursB - joursA;
    });

    return list;
  }, [enJuridique, etapeFilter, avocatFilter, villeFilter, sortMode, now]);

  const actifs = enJuridique.filter((d) => (d.juridique_etape ?? "mise_en_demeure") !== "clos");
  const montantReclame = actifs.reduce(
    (sum, d) => sum + Math.max(0, (d.montant_facture ?? 0) - d.montant_recu),
    0
  );
  const montantJuge = actifs.reduce((sum, d) => sum + (d.montant_jugement ?? 0), 0);
  const montantRecupere = actifs.reduce((sum, d) => sum + d.montant_recu, 0);

  const hasActiveFilters = etapeFilter !== "actifs" || avocatFilter !== "all" || villeFilter !== "all";

  function resetFilters() {
    setEtapeFilter("actifs");
    setAvocatFilter("all");
    setVilleFilter("all");
  }

  return (
    <>
      <Topbar
        title="Suivi juridique"
        description="Dossiers en contentieux — étapes, échéances, montants"
      />
      <div className="px-8 py-6">
        <div className="mb-6 grid grid-cols-4 gap-3.5">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-2">
              Dossiers en contentieux
            </div>
            <div className="mt-1.5 font-display text-[24px] font-bold text-ink">{actifs.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-2">
              Montant réclamé
            </div>
            <div className="mt-1.5 font-mono text-[20px] font-bold text-ink">{formatMontant(montantReclame)}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-2">
              Montant jugé
            </div>
            <div className="mt-1.5 font-mono text-[20px] font-bold text-juridique">{formatMontant(montantJuge)}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-2">
              Déjà récupéré
            </div>
            <div className="mt-1.5 font-mono text-[20px] font-bold text-success">{formatMontant(montantRecupere)}</div>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2.5">
          <Select value={etapeFilter} onValueChange={setEtapeFilter}>
            <SelectTrigger className="w-[210px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="actifs">Étapes actives (hors clos)</SelectItem>
              <SelectItem value="all">Toutes les étapes</SelectItem>
              {JURIDIQUE_ETAPES.map((e) => (
                <SelectItem key={e.key} value={e.key}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {avocats.length > 0 && (
            <Select value={avocatFilter} onValueChange={setAvocatFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les avocats</SelectItem>
                {avocats.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {villes.length > 0 && (
            <Select value={villeFilter} onValueChange={setVilleFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les villes</SelectItem>
                {villes.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="w-[210px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anciennete">Trier par ancienneté d&apos;étape</SelectItem>
              <SelectItem value="montant">Trier par montant</SelectItem>
              <SelectItem value="client">Trier par client (A-Z)</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-[12px] font-semibold text-ink-2 hover:text-danger"
            >
              <X size={13} />
              Réinitialiser
            </button>
          )}

          <span className="ml-auto text-[12px] text-ink-2">
            {filtered.length} dossier{filtered.length > 1 ? "s" : ""}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface py-12 text-center text-ink-2">
            <Scale size={22} className="opacity-40" />
            <div className="font-display text-[15px] font-semibold text-ink">Aucun dossier</div>
            <div className="text-[13px]">Aucun dossier en suivi juridique pour ces filtres.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((d) => {
              const etape = d.juridique_etape ?? "mise_en_demeure";
              const cfg = JURIDIQUE_ETAPES.find((e) => e.key === etape)!;
              const reste = Math.max(0, (d.montant_facture ?? 0) - d.montant_recu);
              const jours = d.juridique_etape_maj_at
                ? differenceInCalendarDays(now, parseISO(d.juridique_etape_maj_at))
                : 0;

              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-border bg-surface p-4 shadow-card border-l-4"
                  style={{ borderLeftColor: "#5B3A8E" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => router.push(`/dossiers/${d.id}`)}>
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Badge color={cfg.color}>{cfg.label}</Badge>
                        {d.ville && (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-ink-2">
                            {d.ville}
                          </span>
                        )}
                      </div>
                      <div className="text-[14px] font-semibold text-ink">{d.client_nom}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
                        <span>Dans cette étape depuis {jours}j</span>
                        {d.avocat_referent && <span>Avocat : {d.avocat_referent}</span>}
                        {d.reference_tribunal && <span>Réf. tribunal : {d.reference_tribunal}</span>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-3">
                        {d.date_mise_en_demeure && <span>Mise en demeure : {formatDate(d.date_mise_en_demeure)}</span>}
                        {d.date_assignation && <span>Assignation : {formatDate(d.date_assignation)}</span>}
                        {d.date_jugement && <span>Jugement : {formatDate(d.date_jugement)}</span>}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="font-mono text-[15px] font-bold text-ink">{formatMontant(reste)}</div>
                      {d.montant_jugement != null && (
                        <div className="text-[10.5px] text-ink-3">jugé : {formatMontant(d.montant_jugement)}</div>
                      )}
                      <Select
                        value={etape}
                        onValueChange={(v) => updateJuridiqueEtape(d.id, v as JuridiqueEtape)}
                      >
                        <SelectTrigger className="w-[190px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {JURIDIQUE_ETAPES.map((e) => (
                            <SelectItem key={e.key} value={e.key}>
                              {e.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" onClick={() => toggleJuridique(d.id)}>
                        Retirer du suivi juridique
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
