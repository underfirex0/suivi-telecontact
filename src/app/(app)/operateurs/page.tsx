"use client";

import { useMemo } from "react";
import { Topbar } from "@/components/topbar";
import { initials, formatMontant } from "@/lib/utils";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { analyzeDossier } from "@/lib/dossier-logic";
import { useNow } from "@/lib/use-now";

export default function OperateursPage() {
  const { profiles, dossiers: allDossiers, loading } = useDossiers();
  const dossiers = allDossiers.filter((d) => !d.archived_at && !d.abandonne_at);
  const now = useNow();

  const stats = useMemo(() => {
    return profiles
      .map((p) => {
        const mine = dossiers.filter((d) => d.operateur_id === p.id);
        const actifs = mine.filter((d) => d.etape !== "paye");
        const enPaiement = mine.filter((d) => d.etape === "paiement");
        const montantEnJeu = enPaiement.reduce(
          (sum, d) => sum + Math.max(0, (d.montant_facture ?? 0) - d.montant_recu),
          0
        );
        const alertesCount = enPaiement.filter((d) => analyzeDossier(d, now).alert).length;
        return { profile: p, actifsCount: actifs.length, montantEnJeu, alertesCount };
      })
      .sort((a, b) => b.montantEnJeu - a.montantEnJeu);
  }, [profiles, dossiers, now]);

  return (
    <>
      <Topbar title="Opérateurs" description="Charge de travail réelle par personne — montant, pas juste nombre" />
      <div className="px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-3 gap-3.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-surface-2" />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface py-10 text-center text-ink-2">
            Aucun opérateur pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3.5">
            {stats.map(({ profile: p, actifsCount, montantEnJeu, alertesCount }) => (
              <div key={p.id} className="rounded-xl border border-border bg-surface p-4.5 shadow-card">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white">
                    {initials(p.full_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-display text-[14px] font-semibold text-ink">
                      {p.full_name}
                    </div>
                    <div className="text-[11.5px] text-ink-2">
                      {actifsCount} dossier{actifsCount !== 1 ? "s" : ""} actif{actifsCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div>
                    <div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-2">
                      Montant en jeu
                    </div>
                    <div className="font-mono text-[16px] font-bold text-ink">{formatMontant(montantEnJeu)}</div>
                  </div>
                  {alertesCount > 0 && (
                    <div className="rounded-full bg-danger-tint px-2.5 py-1 text-[11px] font-bold text-danger">
                      {alertesCount} alerte{alertesCount > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
            ))}
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
