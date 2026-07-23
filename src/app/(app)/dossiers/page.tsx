"use client";

import { useMemo, useState } from "react";
import { Topbar } from "@/components/topbar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KanbanBoard } from "@/components/kanban-board";
import { DossierTable } from "@/components/dossier-table";
import { useDossiers } from "@/components/providers/dossiers-provider";

export default function DossiersPage() {
  const { dossiers, profiles, loading } = useDossiers();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return dossiers;
    const s = search.toLowerCase();
    return dossiers.filter(
      (d) => d.client_nom.toLowerCase().includes(s) || (d.offre ?? "").toLowerCase().includes(s)
    );
  }, [dossiers, search]);

  return (
    <>
      <Topbar
        title="Dossiers"
        description="Vue par étape du processus de référencement"
        search={search}
        onSearchChange={setSearch}
      />
      <div className="px-8 py-6">
        <Tabs defaultValue="kanban">
          <TabsList className="mb-5">
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="table">Liste</TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
          ) : (
            <>
              <TabsContent value="kanban">
                <KanbanBoard dossiers={filtered} />
              </TabsContent>
              <TabsContent value="table">
                <DossierTable dossiers={filtered} profiles={profiles} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </>
  );
}
