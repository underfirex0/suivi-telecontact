"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Archive, RotateCcw } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/kanban-board";
import { DossierTable } from "@/components/dossier-table";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { analyzeDossier } from "@/lib/dossier-logic";
import { useNow } from "@/lib/use-now";
import { cn, formatDate } from "@/lib/utils";

export default function DossiersPage() {
  const { dossiers: allDossiers, profiles, loading, restoreDossier } = useDossiers();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const now = useNow();

  const active = useMemo(() => allDossiers.filter((d) => !d.archived_at), [allDossiers]);
  const archived = useMemo(() => allDossiers.filter((d) => d.archived_at), [allDossiers]);

  const filtered = useMemo(() => {
    if (!search) return active;
    const s = search.toLowerCase();
    return active.filter(
      (d) => d.client_nom.toLowerCase().includes(s) || (d.offre ?? "").toLowerCase().includes(s)
    );
  }, [active, search]);

  const alertCount = useMemo(
    () => filtered.filter((d) => analyzeDossier(d, now).alert).length,
    [filtered, now]
  );

  const tableDossiers = onlyAlerts ? filtered.filter((d) => analyzeDossier(d, now).alert) : filtered;

  const profileMap = useMemo(() => {
    const m = new Map(profiles.map((p) => [p.id, p.full_name]));
    return m;
  }, [profiles]);

  return (
    <>
      <Topbar
        title="Dossiers"
        description="Vue par étape du processus de référencement"
        search={search}
        onSearchChange={setSearch}
      />
      <div className="px-8 py-6">
        {loading ? (
          <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
        ) : (
          <Tabs defaultValue="kanban">
            <div className="mb-5 flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="kanban">Kanban</TabsTrigger>
                <TabsTrigger value="table">Liste</TabsTrigger>
                <TabsTrigger value="archives">
                  Archives{archived.length > 0 ? ` (${archived.length})` : ""}
                </TabsTrigger>
              </TabsList>

              <button
                onClick={() => setOnlyAlerts((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
                  onlyAlerts
                    ? "border-danger bg-danger-tint text-danger"
                    : "border-border bg-surface text-ink-2 hover:bg-surface-2"
                )}
              >
                <AlertTriangle size={14} />
                {onlyAlerts
                  ? `Alertes uniquement (${alertCount})`
                  : `Afficher uniquement les alertes${alertCount > 0 ? ` (${alertCount})` : ""}`}
              </button>
            </div>

            <TabsContent value="kanban">
              <KanbanBoard dossiers={filtered} profiles={profiles} onlyAlerts={onlyAlerts} />
            </TabsContent>
            <TabsContent value="table">
              <DossierTable dossiers={tableDossiers} profiles={profiles} />
            </TabsContent>
            <TabsContent value="archives">
              {archived.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface py-10 text-center text-ink-2">
                  <Archive size={20} className="opacity-40" />
                  <div className="text-[13px]">Aucun dossier archivé.</div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {archived.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-3.5 rounded-xl border border-border bg-surface p-3.5 shadow-card"
                    >
                      <Archive size={15} className="flex-shrink-0 text-ink-3" />
                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => router.push(`/dossiers/${d.id}`)}>
                        <div className="truncate text-[13.5px] font-semibold text-ink">{d.client_nom}</div>
                        <div className="truncate text-[12px] text-ink-2">
                          Archivé le {formatDate(d.archived_at?.slice(0, 10))} par{" "}
                          {d.archived_by ? profileMap.get(d.archived_by) ?? "Inconnu" : "Inconnu"}
                        </div>
                      </div>
                      <Button variant="secondary" onClick={() => restoreDossier(d.id)}>
                        <RotateCcw size={14} />
                        Restaurer
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}
