"use client";

import { Topbar } from "@/components/topbar";
import { initials } from "@/lib/utils";
import { useDossiers } from "@/components/providers/dossiers-provider";

export default function OperateursPage() {
  const { profiles, dossiers, loading } = useDossiers();

  return (
    <>
      <Topbar title="Opérateurs" description="Membres de l'équipe et charge de dossiers" />
      <div className="px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-3 gap-3.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-2" />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface py-10 text-center text-ink-2">
            Aucun opérateur pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3.5">
            {profiles.map((p) => {
              const assigned = dossiers.filter((d) => d.operateur_id === p.id);
              const actifs = assigned.filter((d) => d.etape !== "paye");
              return (
                <div key={p.id} className="rounded-xl border border-border bg-surface p-4.5 shadow-card">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white">
                      {initials(p.full_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-display text-[14px] font-semibold text-ink">
                        {p.full_name}
                      </div>
                      <div className="text-[11.5px] text-ink-2">
                        {actifs.length} dossier{actifs.length !== 1 ? "s" : ""} actif
                        {actifs.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-6 text-[12px] text-ink-3">
          Les opérateurs sont créés automatiquement lorsqu&apos;un compte est enregistré via la page
          d&apos;inscription.
        </p>
      </div>
    </>
  );
}
