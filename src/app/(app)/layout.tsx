"use client";

import { useState } from "react";
import { DossiersProvider } from "@/components/providers/dossiers-provider";
import { Sidebar } from "@/components/sidebar";
import { NewDossierDialog } from "@/components/new-dossier-dialog";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [newDossierOpen, setNewDossierOpen] = useState(false);

  return (
    <DossiersProvider>
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar onNewDossier={() => setNewDossierOpen(true)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <NewDossierDialog open={newDossierOpen} onOpenChange={setNewDossierOpen} />
    </DossiersProvider>
  );
}
