"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PartyPopper, UserX, PhoneOff, CalendarClock } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Badge } from "@/components/ui/badge";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { analyzeDossier, scoreFileAction } from "@/lib/dossier-logic";
import { todayISO, formatMontant } from "@/lib/utils";
import { useNow } from "@/lib/use-now";
import { STATUS_HEX } from "@/lib/status-colors";

export default function DashboardPage() {
  const { dossiers: allDossiers, loading } = useDossiers();
  const dossiers = useMemo(
    () => allDossiers.filter((d) => !d.archived_at && !d.abandonne_at),
    [allDossiers]
  );
  const abandonnes = useMemo(() => allDossiers.filter((d) => d.abandonne_at), [allDossiers]);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const now = useNow();

  const filtered = useMemo(() => {
    if (!search) return dossiers;
    const s = search.toLowerCase();
    return dossiers.filter(
      (d) => d.client_nom.toLowerCase().includes(s) || (d.offre ?? "").toLowerCase().includes(s)
    );
  }, [dossiers, search]);

  const analyzed = useMemo(
    () => filtered.map((d) => ({ d, a: analyzeDossier(d, now) })),
    [filtered, now]
  );

  const enPaiement = analyzed.filter((x) => x.d.etape === "paiement");
  const active = filtered.filter((d) => d.etape !== "paye");
  const enQc = filtered.filter((d) => d.etape === "qc");
  const payeThisMonth = filtered.filter(
    (d) => d.etape === "paye" && d.date_paiement && d.date_paiement.slice(0, 7) === todayISO().slice(0, 7)
  ).length;

  const montantEnJeu = enPaiement.reduce(
    (sum, x) => sum + Math.max(0, (x.d.montant_facture ?? 0) - x.d.montant_recu),
    0
  );
  const montantPerduTotal = enPaiement
    .filter((x) => x.a.columnKey === "perte_totale")
    .reduce((sum, x) => sum + Math.max(0, (x.d.montant_facture ?? 0) - x.d.montant_recu), 0);
  const montantRecuperable = montantEnJeu - montantPerduTotal;
  const montantAbandonne = abandonnes.reduce(
    (sum, d) => sum + Math.max(0, (d.montant_facture ?? 0) - d.montant_recu),
    0
  );

  const fileAction = enPaiement
    .filter((x) => x.a.alert)
    .sort((x, y) => scoreFileAction(y.d, y.a) - scoreFileAction(x.d, x.a));

  const nonAssignes = fileAction.filter((x) => !x.d.operateur_id);
  const promessesRompues = fileAction.filter((x) => x.a.promesseRompue);
  const rappelsDus = fileAction.filter((x) => x.a.rappelDu);

  const kpis = [
    { label: "Dossiers actifs", value: active.length, cls: "" },
    { label: "En QC / à traiter", value: enQc.length, cls: "" },
    { label: "Payés ce mois", value: payeThisMonth, cls: "text-success" },
  ];

  return (
    <>
      <Topbar
        title="Tableau de bord"
        description="Vue d'ensemble financière et priorités du jour"
        search={search}
        onSearchChange={setSearch}
      />
      <div className="px-8 py-6">
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Totaux financiers — ce qui compte vraiment */}
            <div className="mb-3 font-display text-[13px] font-semibold uppercase tracking-wide text-ink-2">
              Situation financière
            </div>
            <div className="mb-7 grid grid-cols-4 gap-3.5">
              <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-2">
                  Montant en jeu
                </div>
                <div className="mt-1.5 font-mono text-[22px] font-bold text-ink">
                  {formatMontant(montantEnJeu)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-2">
                  Encore récupérable
                </div>
                <div className="mt-1.5 font-mono text-[22px] font-bold text-success">
                  {formatMontant(montantRecuperable)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-2">
                  Perdu définitivement
                </div>
                <div className="mt-1.5 font-mono text-[22px] font-bold text-[#7A2E1F]">
                  {formatMontant(montantPerduTotal)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-2">
                  Abandonné ({abandonnes.length})
                </div>
                <div className="mt-1.5 font-mono text-[22px] font-bold text-ink-2">
                  {formatMontant(montantAbandonne)}
                </div>
              </div>
            </div>

            <div className="mb-7 grid grid-cols-3 gap-3.5">
              {kpis.map((k) => (
                <div key={k.label} className="rounded-xl border border-border bg-surface p-4 shadow-card">
                  <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-2">
                    {k.label}
                  </div>
                  <div className={`mt-1.5 font-display text-[24px] font-bold text-ink ${k.cls}`}>
                    {k.value}
                  </div>
                </div>
              ))}
            </div>

            {nonAssignes.length > 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-warn/30 bg-warn-tint px-4 py-3 text-[13px] font-semibold text-warn">
                <UserX size={15} />
                {nonAssignes.length} dossier{nonAssignes.length > 1 ? "s" : ""} prioritaire
                {nonAssignes.length > 1 ? "s" : ""} sans opérateur affecté.
              </div>
            )}

            {promessesRompues.length > 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-[13px] font-semibold text-danger">
                <PhoneOff size={15} />
                {promessesRompues.length} client{promessesRompues.length > 1 ? "s" : ""} n&apos;
                {promessesRompues.length > 1 ? "ont" : "a"} pas tenu leur promesse de paiement.
              </div>
            )}

            {rappelsDus.length > 0 && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-warn/30 bg-warn-tint px-4 py-3 text-[13px] font-semibold text-warn">
                <CalendarClock size={15} />
                {rappelsDus.length} rappel{rappelsDus.length > 1 ? "s" : ""} prévu{rappelsDus.length > 1 ? "s" : ""}{" "}
                aujourd&apos;hui ou en retard.
              </div>
            )}

            <div className="mb-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-display text-[14.5px] font-semibold text-ink">
                🔥 File d&apos;action — top priorités
                <span className="font-body text-[13px] font-medium text-ink-2">({fileAction.length})</span>
              </div>
              <button
                onClick={() => router.push("/dossiers")}
                className="text-[12.5px] font-semibold text-brand hover:underline"
              >
                Voir toute la file d&apos;action →
              </button>
            </div>

            {fileAction.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface py-10 text-center text-ink-2">
                <PartyPopper size={22} className="text-success" />
                <div className="font-display text-[15px] font-semibold text-ink">Rien à signaler</div>
                <div className="text-[13px]">Aucun dossier ne nécessite d&apos;action pour le moment.</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {fileAction.slice(0, 8).map(({ d, a }) => {
                  const reste = Math.max(0, (d.montant_facture ?? 0) - d.montant_recu);
                  return (
                    <button
                      key={d.id}
                      onClick={() => router.push(`/dossiers/${d.id}`)}
                      className="flex items-center gap-3.5 rounded-xl border border-border bg-surface p-3.5 pl-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-lg border-l-4"
                      style={{ borderLeftColor: STATUS_HEX[a.color] }}
                    >
                      <Badge color={a.color}>{a.label}</Badge>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold text-ink">{d.client_nom}</div>
                        <div className="truncate text-[12px] text-ink-2">
                          {a.joursSansAction != null && a.joursSansAction > 0
                            ? `${a.joursSansAction}j sans action`
                            : "Aucune action enregistrée"}
                          {!d.operateur_id && " · non affecté"}
                        </div>
                      </div>
                      <div className="whitespace-nowrap font-mono text-[12.5px] font-semibold text-ink">
                        {formatMontant(reste)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-7 grid grid-cols-4 gap-3.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[78px] rounded-xl bg-surface-2" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[58px] rounded-xl bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
