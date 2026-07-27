"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PartyPopper, AlertTriangle } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Badge } from "@/components/ui/badge";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { analyzeDossier } from "@/lib/dossier-logic";
import { todayISO } from "@/lib/utils";
import { useNow } from "@/lib/use-now";
import { STATUS_HEX } from "@/lib/status-colors";

export default function DashboardPage() {
  const { dossiers: allDossiers, loading } = useDossiers();
  const dossiers = useMemo(() => allDossiers.filter((d) => !d.archived_at), [allDossiers]);
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

  const active = filtered.filter((d) => d.etape !== "paye");
  const enQc = filtered.filter((d) => d.etape === "qc");
  const alerts = analyzed.filter((x) => x.a.alert).sort((x, y) => y.a.severity - x.a.severity);
  const juridiqueCount = analyzed.filter((x) => x.a.columnKey === "juridique").length;
  const relanceCount = analyzed.filter((x) => x.a.columnKey === "paiement" && x.a.alert).length;
  const perteCount = analyzed.filter((x) => x.a.columnKey === "perte").length;
  const payeThisMonth = filtered.filter(
    (d) => d.etape === "paye" && d.date_paiement && d.date_paiement.slice(0, 7) === todayISO().slice(0, 7)
  ).length;

  const desyncList = analyzed
    .filter((x) => x.a.desyncRisque)
    .sort(
      (x, y) =>
        (y.a.pctTemps ?? 0) - (y.a.pctPaye ?? 0) - ((x.a.pctTemps ?? 0) - (x.a.pctPaye ?? 0))
    );

  const kpis = [
    { label: "Dossiers actifs", value: active.length, cls: "" },
    { label: "En QC / à traiter", value: enQc.length, cls: "" },
    { label: "Relances en cours", value: relanceCount, cls: relanceCount > 0 ? "text-warn" : "" },
    { label: "Suivi juridique", value: juridiqueCount, cls: juridiqueCount > 0 ? "text-juridique" : "" },
    { label: "Pertes réelles", value: perteCount, cls: perteCount > 0 ? "text-[#7A2E1F]" : "" },
    { label: "Payés ce mois", value: payeThisMonth, cls: "text-success" },
  ];

  return (
    <>
      <Topbar
        title="Tableau de bord"
        description="Vue d'ensemble de tous les dossiers actifs"
        search={search}
        onSearchChange={setSearch}
      />
      <div className="px-8 py-6">
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <div className="mb-7 grid grid-cols-6 gap-3.5">
              {kpis.map((k) => (
                <div key={k.label} className="rounded-xl border border-border bg-surface p-4 shadow-card">
                  <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-2">
                    {k.label}
                  </div>
                  <div className={`mt-1.5 font-display text-[28px] font-bold text-ink ${k.cls}`}>
                    {k.value}
                  </div>
                </div>
              ))}
            </div>

            {desyncList.length > 0 && (
              <div className="mb-7">
                <div className="mb-3 flex items-center gap-2 font-display text-[14.5px] font-semibold text-ink">
                  <AlertTriangle size={16} className="text-warn" />
                  Risque de désynchronisation — agir avant la perte totale
                  <span className="font-body text-[13px] font-medium text-ink-2">({desyncList.length})</span>
                </div>
                <div className="flex flex-col gap-2">
                  {desyncList.map(({ d, a }) => (
                    <button
                      key={d.id}
                      onClick={() => router.push(`/dossiers/${d.id}`)}
                      className="flex items-center gap-3.5 rounded-xl border border-warn/30 bg-warn-tint/40 p-3.5 pl-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-lg border-l-4"
                      style={{ borderLeftColor: STATUS_HEX.warning }}
                    >
                      <Badge color="warning">⚠ Désynchronisation</Badge>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold text-ink">{d.client_nom}</div>
                        <div className="truncate text-[12px] text-ink-2">{d.offre || "—"}</div>
                      </div>
                      <div className="whitespace-nowrap font-mono text-[11.5px] text-ink-2">
                        {Math.round(a.pctTemps ?? 0)}% temps · {Math.round(a.pctPaye ?? 0)}% payé
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-3.5 flex items-center gap-2 font-display text-[14.5px] font-semibold text-ink">
              🔥 Nécessite une action
              <span className="font-body text-[13px] font-medium text-ink-2">({alerts.length})</span>
            </div>

            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface py-10 text-center text-ink-2">
                <PartyPopper size={22} className="text-success" />
                <div className="font-display text-[15px] font-semibold text-ink">Rien à signaler</div>
                <div className="text-[13px]">Aucun dossier en retard pour le moment.</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {alerts.map(({ d, a }) => (
                  <button
                    key={d.id}
                    onClick={() => router.push(`/dossiers/${d.id}`)}
                    className={`flex items-center gap-3.5 rounded-xl border border-border bg-surface p-3.5 pl-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-lg border-l-4`}
                    style={{ borderLeftColor: STATUS_HEX[a.color] }}
                  >
                    <Badge color={a.color}>{a.label}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-ink">{d.client_nom}</div>
                      <div className="truncate text-[12px] text-ink-2">{d.offre || "—"}</div>
                    </div>
                    <div className="whitespace-nowrap font-mono text-[11.5px] text-ink-2">{a.sub}</div>
                  </button>
                ))}
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
      <div className="mb-7 grid grid-cols-6 gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => (
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
