"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, PhoneCall, Ban, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionLogDialog } from "@/components/action-log-dialog";
import { AbandonDialog } from "@/components/abandon-dialog";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { analyzeDossier, scoreFileAction } from "@/lib/dossier-logic";
import { useNow } from "@/lib/use-now";
import { formatMontant, initials } from "@/lib/utils";
import { STATUS_HEX } from "@/lib/status-colors";
import type { Dossier, Profile } from "@/lib/types";

export function FileAction({ dossiers, profiles }: { dossiers: Dossier[]; profiles: Profile[] }) {
  const router = useRouter();
  const now = useNow();
  const { addAction, claimDossier, abandonDossier } = useDossiers();
  const [actionDossier, setActionDossier] = useState<Dossier | null>(null);
  const [abandonDossierTarget, setAbandonDossierTarget] = useState<Dossier | null>(null);

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p.full_name])), [profiles]);

  const items = useMemo(() => {
    return dossiers
      .filter((d) => d.etape === "paiement")
      .map((d) => ({ d, a: analyzeDossier(d, now) }))
      .filter((x) => x.a.alert)
      .sort((x, y) => scoreFileAction(y.d, y.a) - scoreFileAction(x.d, x.a));
  }, [dossiers, now]);

  return (
    <div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface py-12 text-center text-ink-2">
          <PartyPopper size={22} className="text-success" />
          <div className="font-display text-[15px] font-semibold text-ink">File d&apos;action vide</div>
          <div className="text-[13px]">Aucun dossier ne nécessite d&apos;action pour le moment.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map(({ d, a }) => {
            const reste = Math.max(0, (d.montant_facture ?? 0) - d.montant_recu);
            const operateurName = d.operateur_id ? profileMap.get(d.operateur_id) : null;
            return (
              <div
                key={d.id}
                className="rounded-xl border border-border bg-surface p-4 shadow-card border-l-4"
                style={{ borderLeftColor: STATUS_HEX[a.color] }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => router.push(`/dossiers/${d.id}`)}>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge color={a.color}>{a.label}</Badge>
                      {!operateurName && (
                        <span className="rounded-full bg-warn-tint px-2 py-0.5 text-[10.5px] font-bold text-warn">
                          Non assigné
                        </span>
                      )}
                    </div>
                    <div className="text-[14px] font-semibold text-ink">{d.client_nom}</div>
                    <div className="text-[12px] text-ink-2">{d.offre || "—"}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
                      <span>
                        {a.joursSansAction != null && a.joursSansAction > 0
                          ? `${a.joursSansAction}j sans action`
                          : "Aucune action enregistrée"}
                      </span>
                      {d.prochain_rappel && <span>Rappel prévu le {d.prochain_rappel}</span>}
                      {operateurName && (
                        <span className="flex items-center gap-1.5">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-tint text-[8.5px] font-bold text-brand">
                            {initials(operateurName)}
                          </span>
                          {operateurName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="font-mono text-[15px] font-bold text-ink">{formatMontant(reste)}</div>
                    <div className="flex gap-1.5">
                      {!d.operateur_id && (
                        <Button variant="secondary" onClick={() => claimDossier(d.id)}>
                          <UserPlus size={13} />
                          Me l&apos;assigner
                        </Button>
                      )}
                      <Button variant="primary" onClick={() => setActionDossier(d)}>
                        <PhoneCall size={13} />
                        Traiter
                      </Button>
                      <Button variant="ghost" onClick={() => setAbandonDossierTarget(d)}>
                        <Ban size={13} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {actionDossier && (
        <ActionLogDialog
          open={!!actionDossier}
          onOpenChange={(open) => !open && setActionDossier(null)}
          onConfirm={(type, resultat, note, dateRappel) =>
            addAction(actionDossier.id, type, resultat, note, dateRappel)
          }
        />
      )}
      {abandonDossierTarget && (
        <AbandonDialog
          open={!!abandonDossierTarget}
          onOpenChange={(open) => !open && setAbandonDossierTarget(null)}
          clientNom={abandonDossierTarget.client_nom}
          onConfirm={(raison) => abandonDossier(abandonDossierTarget.id, raison)}
        />
      )}
    </div>
  );
}
