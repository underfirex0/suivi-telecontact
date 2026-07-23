"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KanbanBoard } from "@/components/kanban-board";
import { DossierTable } from "@/components/dossier-table";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { analyzeDossier } from "@/lib/dossier-logic";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

export default function DossiersPage() {
  const { dossiers, profiles, loading } = useDossiers();
  const [search, setSearch] = useState("");
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const now = useNow();

  const filtered = useMemo(() => {
    if (!search) return dossiers;
    const s = search.toLowerCase();
    return dossiers.filter(
      (d) => d.client_nom.toLowerCase().includes(s) || (d.offre ?? "").toLowerCase().includes(s)
    );
  }, [dossiers, search]);

  const alertCount = useMemo(
    () => filtered.filter((d) => analyzeDossier(d, now).alert).length,
    [filtered, now]
  );

  const tableDossiers = onlyAlerts ? filtered.filter((d) => analyzeDossier(d, now).alert) : filtered;

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
                {onlyAlerts ? `Alertes uniquement (${alertCount})` : `Afficher uniquement les alertes${alertCount > 0 ? ` (${alertCount})` : ""}`}
              </button>
            </div>

            <TabsContent value="kanban">
              <KanbanBoard dossiers={filtered} profiles={profiles} onlyAlerts={onlyAlerts} />
            </TabsContent>
            <TabsContent value="table">
              <DossierTable dossiers={tableDossiers} profiles={profiles} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}
