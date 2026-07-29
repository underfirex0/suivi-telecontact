"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  Mail,
  MapPin,
  Handshake,
  MoreHorizontal,
  X,
  RefreshCw,
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { analyzeDossier } from "@/lib/dossier-logic";
import { useNow } from "@/lib/use-now";
import { cn, initials } from "@/lib/utils";
import type { ActionEntry, ActionType } from "@/lib/types";

const TYPE_CONFIG: Record<ActionType, { label: string; icon: typeof Phone; color: string }> = {
  appel: { label: "Appel", icon: Phone, color: "#0E7C7B" },
  email: { label: "Email", icon: Mail, color: "#5B3A8E" },
  visite: { label: "Visite", icon: MapPin, color: "#C2790A" },
  promesse_paiement: { label: "Promesse de paiement", icon: Handshake, color: "#1F8A55" },
  autre: { label: "Autre", icon: MoreHorizontal, color: "#6B7280" },
};

type Periode = "aujourdhui" | "semaine" | "mois" | "tout";

export default function ActivitePage() {
  const { dossiers, profiles, fetchAllActions, currentProfile } = useDossiers();
  const router = useRouter();
  const now = useNow();

  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [loadingActions, setLoadingActions] = useState(true);
  const [search, setSearch] = useState("");
  const [operateurFilter, setOperateurFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [periode, setPeriode] = useState<Periode>("semaine");
  const [onlyRompues, setOnlyRompues] = useState(false);

  const dossiersById = useMemo(() => new Map(dossiers.map((d) => [d.id, d])), [dossiers]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p.full_name])), [profiles]);

  async function load() {
    setLoadingActions(true);
    const data = await fetchAllActions();
    setActions(data);
    setLoadingActions(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const periodeStart = useMemo(() => {
    const d = new Date(now);
    if (periode === "aujourdhui") {
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (periode === "semaine") {
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (periode === "mois") {
      d.setDate(d.getDate() - 30);
      return d;
    }
    return null; // tout
  }, [periode, now]);

  const enriched = useMemo(() => {
    return actions
      .map((act) => {
        const dossier = dossiersById.get(act.dossier_id) ?? null;
        let estRompue = false;
        if (dossier && act.type === "promesse_paiement" && dossier.prochain_rappel === act.date_rappel) {
          estRompue = analyzeDossier(dossier, now).promesseRompue;
        }
        return { act, dossier, estRompue };
      })
      .filter((x) => x.dossier !== null); // ignore actions orphelines (dossier supprimé)
  }, [actions, dossiersById, now]);

  const filtered = useMemo(() => {
    return enriched.filter(({ act, dossier, estRompue }) => {
      if (periodeStart && new Date(act.created_at) < periodeStart) return false;
      if (operateurFilter === "moi" && act.created_by !== currentProfile?.id) return false;
      if (operateurFilter !== "all" && operateurFilter !== "moi" && act.created_by !== operateurFilter) return false;
      if (typeFilter !== "all" && act.type !== typeFilter) return false;
      if (onlyRompues && !estRompue) return false;
      if (search && !dossier!.client_nom.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [enriched, periodeStart, operateurFilter, typeFilter, onlyRompues, search, currentProfile]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(({ act }) => {
      counts[act.type] = (counts[act.type] ?? 0) + 1;
    });
    return counts;
  }, [filtered]);

  const leaderboard = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach(({ act }) => {
      if (!act.created_by) return;
      counts.set(act.created_by, (counts.get(act.created_by) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, name: profileMap.get(id) ?? "Inconnu", count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered, profileMap]);

  const hasActiveFilters =
    !!search || operateurFilter !== "all" || typeFilter !== "all" || onlyRompues || periode !== "semaine";

  function resetFilters() {
    setSearch("");
    setOperateurFilter("all");
    setTypeFilter("all");
    setOnlyRompues(false);
    setPeriode("semaine");
  }

  return (
    <>
      <Topbar
        title="Activité"
        description="Journal de toutes les actions enregistrées par l'équipe"
        search={search}
        onSearchChange={setSearch}
      />
      <div className="px-8 py-6">
        {/* Résumé */}
        <div className="mb-5 grid grid-cols-6 gap-3">
          <div className="rounded-xl border border-border bg-surface p-3.5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Total</div>
            <div className="mt-1 font-display text-[22px] font-bold text-ink">{filtered.length}</div>
          </div>
          {(Object.keys(TYPE_CONFIG) as ActionType[]).map((t) => {
            const cfg = TYPE_CONFIG[t];
            const Icon = cfg.icon;
            return (
              <div key={t} className="rounded-xl border border-border bg-surface p-3.5 shadow-card">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
                  <Icon size={11} />
                  {cfg.label}
                </div>
                <div className="mt-1 font-display text-[22px] font-bold text-ink">{typeCounts[t] ?? 0}</div>
              </div>
            );
          })}
        </div>

        <div className="mb-6 flex gap-4">
          {/* Filtres + liste */}
          <div className="flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {(["aujourdhui", "semaine", "mois", "tout"] as Periode[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriode(p)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                    periode === p
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-surface text-ink-2 hover:bg-surface-2"
                  )}
                >
                  {p === "aujourdhui" ? "Aujourd'hui" : p === "semaine" ? "7 derniers jours" : p === "mois" ? "30 derniers jours" : "Tout"}
                </button>
              ))}
              <button
                onClick={() => setOnlyRompues((v) => !v)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  onlyRompues
                    ? "border-danger bg-danger-tint text-danger"
                    : "border-border bg-surface text-ink-2 hover:bg-surface-2"
                )}
              >
                Promesses non tenues
              </button>
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-2.5">
              <Select value={operateurFilter} onValueChange={setOperateurFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les opérateurs</SelectItem>
                  {currentProfile && <SelectItem value="moi">Moi</SelectItem>}
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {(Object.keys(TYPE_CONFIG) as ActionType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_CONFIG[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="secondary" onClick={load}>
                <RefreshCw size={14} />
              </Button>

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-[12px] font-semibold text-ink-2 hover:text-danger"
                >
                  <X size={13} />
                  Réinitialiser
                </button>
              )}
            </div>

            {loadingActions ? (
              <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface py-12 text-center text-ink-2">
                <div className="text-[13px]">Aucune action pour ces filtres.</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map(({ act, dossier, estRompue }) => {
                  const cfg = TYPE_CONFIG[act.type];
                  const Icon = cfg.icon;
                  const auteur = act.created_by ? profileMap.get(act.created_by) ?? "Inconnu" : "Inconnu";
                  return (
                    <div
                      key={act.id}
                      onClick={() => router.push(`/dossiers/${dossier!.id}`)}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border bg-surface p-3.5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-lg",
                        estRompue ? "border-danger/40" : "border-border"
                      )}
                    >
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${cfg.color}1A`, color: cfg.color }}
                      >
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-semibold text-ink">{dossier!.client_nom}</span>
                          <span className="text-[11px] font-semibold text-ink-3">{cfg.label}</span>
                          {estRompue && (
                            <span className="rounded-full bg-danger-tint px-2 py-0.5 text-[10px] font-bold text-danger">
                              Promesse non tenue
                            </span>
                          )}
                        </div>
                        {act.resultat && <div className="mt-0.5 text-[12.5px] text-ink-2">{act.resultat}</div>}
                        {act.note && <div className="mt-0.5 text-[11.5px] text-ink-3">{act.note}</div>}
                        {act.date_rappel && (
                          <div className="mt-1 text-[11px] font-semibold text-brand">
                            Rappel prévu le {act.date_rappel}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1 text-right">
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-tint text-[9px] font-bold text-brand">
                            {initials(auteur)}
                          </span>
                          <span className="text-[11.5px] font-semibold text-ink-2">{auteur}</span>
                        </div>
                        <span className="text-[10.5px] text-ink-3">
                          {new Date(act.created_at).toLocaleString("fr-FR")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Classement activité */}
          {leaderboard.length > 0 && (
            <div className="w-[220px] flex-shrink-0">
              <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                <div className="mb-3 font-display text-[13px] font-semibold text-ink">Activité de l&apos;équipe</div>
                <div className="flex flex-col gap-2.5">
                  {leaderboard.map((l) => (
                    <div key={l.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-tint text-[10px] font-bold text-brand">
                          {initials(l.name)}
                        </span>
                        <span className="text-[12.5px] text-ink">{l.name}</span>
                      </div>
                      <span className="font-mono text-[12.5px] font-semibold text-ink-2">{l.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
