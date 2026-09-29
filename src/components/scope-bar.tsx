"use client";

import { useMemo, useState } from "react";
import { Globe, BookOpen, Settings2, CheckCircle2 } from "lucide-react";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { useScope } from "@/components/providers/scope-provider";
import { EditionsDialog } from "@/components/editions-dialog";
import { matchesScope } from "@/lib/scope";
import { SOCIETES, editionTab } from "@/lib/tags";
import { cn } from "@/lib/utils";
import type { EditionStatut } from "@/lib/types";

/**
 * Barre de navigation Société → Édition → Support.
 * Chaque choix affiche le nombre de dossiers qu'il contiendrait : on sait avant de cliquer.
 */
export function ScopeBar() {
  const { dossiers, editions } = useDossiers();
  const { scope, setSociete, setEdition, setSupport } = useScope();
  const [editionsOpen, setEditionsOpen] = useState(false);

  const actifs = useMemo(() => dossiers.filter((d) => !d.archived_at), [dossiers]);

  const countSociete = (s: "all" | "telecontact" | "kompass") =>
    actifs.filter(
      (d) => matchesScope(d, scope, { ignoreSociete: true, ignoreEdition: true }) && (s === "all" || d.societe === s)
    ).length;

  const countSupport = (s: "all" | "internet" | "papier") =>
    actifs.filter((d) => matchesScope(d, scope, { ignoreSupport: true }) && (s === "all" || d.support === s)).length;

  const societeChoisie = scope.societe === "all" ? null : scope.societe;

  const editionTabs = useMemo(() => {
    if (!societeChoisie) return null;
    const map = new Map<number, EditionStatut>();
    editions.filter((e) => e.societe === societeChoisie).forEach((e) => map.set(e.numero, e.statut));
    actifs
      .filter((d) => d.societe === societeChoisie && d.edition != null)
      .forEach((d) => {
        if (!map.has(d.edition as number)) map.set(d.edition as number, "en_cours");
      });
    const all = Array.from(map.entries()).map(([numero, statut]) => ({ numero, statut }));
    const supportFilter = (d: { support: string }) => scope.support === "all" || d.support === scope.support;
    const count = (n: number) =>
      actifs.filter((d) => d.societe === societeChoisie && d.edition === n && supportFilter(d)).length;
    const sansEdition = actifs.filter(
      (d) => d.societe === societeChoisie && d.edition == null && supportFilter(d)
    ).length;
    return {
      enCours: all
        .filter((e) => e.statut === "en_cours")
        .sort((a, b) => b.numero - a.numero)
        .map((e) => ({ ...e, count: count(e.numero) })),
      terminees: all
        .filter((e) => e.statut === "terminee")
        .sort((a, b) => b.numero - a.numero)
        .map((e) => ({ ...e, count: count(e.numero) })),
      total: actifs.filter((d) => d.societe === societeChoisie && supportFilter(d)).length,
      sansEdition,
    };
  }, [editions, actifs, societeChoisie, scope.support]);

  const societeColor = societeChoisie ? SOCIETES.find((s) => s.key === societeChoisie)!.color : "#0E7C7B";

  function EditionPill({ label, count, active, muted, onClick, title }: {
    label: string;
    count: number;
    active: boolean;
    muted?: boolean;
    onClick: () => void;
    title?: string;
  }) {
    return (
      <button
        onClick={onClick}
        title={title}
        className={cn(
          "flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors",
          active ? "border-transparent text-white" : "border-border bg-surface hover:bg-surface-2",
          !active && (muted ? "text-ink-3" : "text-ink-2")
        )}
        style={active ? { backgroundColor: societeColor } : undefined}
      >
        {muted && !active && <CheckCircle2 size={11} />}
        {label}
        <span className={cn("font-mono text-[10.5px]", active ? "text-white/80" : "text-ink-3")}>{count}</span>
      </button>
    );
  }

  const Divider = () => <div className="hidden h-6 w-px flex-shrink-0 bg-border md:block" />;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-8 py-2.5">
        {/* Société */}
        <div className="inline-flex flex-shrink-0 rounded-lg bg-surface-2 p-1">
          {([{ key: "all", label: "Toutes", color: "#5B6072" }, ...SOCIETES] as const).map((s) => {
            const active = scope.societe === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSociete(s.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  active ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink"
                )}
              >
                {s.key !== "all" && (
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                )}
                {s.label}
                <span className="font-mono text-[10.5px] text-ink-3">{countSociete(s.key)}</span>
              </button>
            );
          })}
        </div>

        <Divider />

        {/* Édition */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5">
          {!editionTabs ? (
            <span className="text-[12px] text-ink-3">Choisissez une société pour filtrer par édition</span>
          ) : (
            <>
              <EditionPill
                label="Toutes"
                count={editionTabs.total}
                active={scope.edition === "all"}
                onClick={() => setEdition("all")}
              />
              {editionTabs.enCours.map((e) => (
                <EditionPill
                  key={e.numero}
                  label={editionTab(e.numero)}
                  count={e.count}
                  active={scope.edition === e.numero}
                  onClick={() => setEdition(e.numero)}
                />
              ))}
              {editionTabs.terminees.length > 0 && (
                <span className="mx-1 flex-shrink-0 text-[10.5px] font-semibold uppercase tracking-wide text-ink-3">
                  Terminées
                </span>
              )}
              {editionTabs.terminees.map((e) => (
                <EditionPill
                  key={e.numero}
                  label={editionTab(e.numero)}
                  count={e.count}
                  active={scope.edition === e.numero}
                  muted
                  title="Édition terminée"
                  onClick={() => setEdition(e.numero)}
                />
              ))}
              {(editionTabs.sansEdition > 0 || scope.edition === "none") && (
                <EditionPill
                  label="Sans édition"
                  count={editionTabs.sansEdition}
                  active={scope.edition === "none"}
                  title="Dossiers pas encore classés dans une édition"
                  onClick={() => setEdition("none")}
                />
              )}
            </>
          )}
        </div>

        <Divider />

        {/* Support */}
        <div className="inline-flex flex-shrink-0 rounded-lg bg-surface-2 p-1">
          {(
            [
              { key: "all", label: "Tous", icon: null },
              { key: "internet", label: "Internet", icon: Globe },
              { key: "papier", label: "Papier", icon: BookOpen },
            ] as const
          ).map((s) => {
            const active = scope.support === s.key;
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setSupport(s.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  active ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink"
                )}
              >
                {Icon && <Icon size={12} />}
                {s.label}
                <span className="font-mono text-[10.5px] text-ink-3">{countSupport(s.key)}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setEditionsOpen(true)}
          title="Gérer les éditions (statut, date de sortie de l'annuaire)"
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink-2 transition-colors hover:bg-surface-2"
        >
          <Settings2 size={13} />
          Éditions
        </button>
      </div>
      <EditionsDialog open={editionsOpen} onOpenChange={setEditionsOpen} />
    </>
  );
}
