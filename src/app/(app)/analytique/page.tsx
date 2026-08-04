"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Topbar } from "@/components/topbar";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { analyzeDossier, JURIDIQUE_ETAPES } from "@/lib/dossier-logic";
import { useNow } from "@/lib/use-now";
import { formatMontant, initials } from "@/lib/utils";
import { STATUS_HEX } from "@/lib/status-colors";
import { parseISO, subDays, format as fmtDate, startOfMonth, subMonths } from "date-fns";
import type { Paiement, ActionEntry, ImportBatch } from "@/lib/types";

type Periode = "30" | "90" | "365" | "tout";

const PIPELINE_BUCKETS: { key: string; label: string; color: string }[] = [
  { key: "qc", label: "Contrôle qualité", color: STATUS_HEX.neutral },
  { key: "a_corriger", label: "À corriger", color: STATUS_HEX.warning },
  { key: "facturation", label: "Validé — à facturer", color: STATUS_HEX.success },
  { key: "paiement_calme", label: "En attente (calme)", color: "#9297A6" },
  { key: "paiement_alerte", label: "Relances / risques", color: STATUS_HEX.warning },
  { key: "juridique", label: "Suivi juridique", color: STATUS_HEX.juridique },
  { key: "perte_totale", label: "Perte totale", color: STATUS_HEX.perte },
  { key: "perte_partielle", label: "Perte récupérable", color: STATUS_HEX.danger },
  { key: "paye", label: "Payé", color: STATUS_HEX.success },
];

export default function AnalytiquePage() {
  const { dossiers: allDossiers, profiles, fetchAllPaiements, fetchAllActions, fetchImportBatches } = useDossiers();
  const router = useRouter();
  const now = useNow();

  const [periode, setPeriode] = useState<Periode>("90");
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchAllPaiements(), fetchAllActions(), fetchImportBatches()]).then(([p, a, i]) => {
      setPaiements(p);
      setActions(a);
      setImports(i);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dossiers = useMemo(() => allDossiers.filter((d) => !d.archived_at), [allDossiers]);
  const actifs = useMemo(() => dossiers.filter((d) => !d.abandonne_at), [dossiers]);

  const periodeStart = useMemo(() => {
    if (periode === "tout") return null;
    return subDays(now, Number(periode));
  }, [periode, now]);

  const inPeriode = (dateStr: string | null) => {
    if (!dateStr) return false;
    if (!periodeStart) return true;
    return parseISO(dateStr) >= periodeStart;
  };

  // --- KPIs financiers ---
  const montantFacture = useMemo(
    () => dossiers.filter((d) => inPeriode(d.date_facture)).reduce((s, d) => s + (d.montant_facture ?? 0), 0),
    [dossiers, periodeStart]
  );
  const montantEncaisse = useMemo(
    () => paiements.filter((p) => inPeriode(p.date_paiement)).reduce((s, p) => s + p.montant, 0),
    [paiements, periodeStart]
  );
  const tauxRecouvrement = montantFacture > 0 ? Math.round((montantEncaisse / montantFacture) * 100) : null;

  const montantPerduTotal = useMemo(
    () =>
      actifs
        .filter((d) => d.etape === "paiement" && analyzeDossier(d, now).columnKey === "perte_totale")
        .reduce((s, d) => s + Math.max(0, (d.montant_facture ?? 0) - d.montant_recu), 0),
    [actifs, now]
  );
  const montantRecuperable = useMemo(
    () =>
      actifs
        .filter((d) => d.etape === "paiement" && analyzeDossier(d, now).columnKey !== "perte_totale")
        .reduce((s, d) => s + Math.max(0, (d.montant_facture ?? 0) - d.montant_recu), 0),
    [actifs, now]
  );
  const montantAbandonne = useMemo(
    () =>
      dossiers
        .filter((d) => d.abandonne_at)
        .reduce((s, d) => s + Math.max(0, (d.montant_facture ?? 0) - d.montant_recu), 0),
    [dossiers]
  );

  // --- Tendance mensuelle (6 derniers mois) : facturé vs encaissé ---
  const tendance = useMemo(() => {
    const months: { key: string; label: string; facture: number; encaisse: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(now, i));
      months.push({ key: fmtDate(d, "yyyy-MM"), label: fmtDate(d, "MMM yy"), facture: 0, encaisse: 0 });
    }
    const byKey = new Map(months.map((m) => [m.key, m]));
    dossiers.forEach((d) => {
      if (!d.date_facture) return;
      const key = d.date_facture.slice(0, 7);
      const m = byKey.get(key);
      if (m) m.facture += d.montant_facture ?? 0;
    });
    paiements.forEach((p) => {
      const key = p.date_paiement.slice(0, 7);
      const m = byKey.get(key);
      if (m) m.encaisse += p.montant;
    });
    return months;
  }, [dossiers, paiements, now]);

  // --- Répartition du pipeline ---
  const pipelineData = useMemo(() => {
    const counts: Record<string, number> = {};
    PIPELINE_BUCKETS.forEach((b) => (counts[b.key] = 0));
    actifs.forEach((d) => {
      const a = analyzeDossier(d, now);
      if (a.columnKey === "abandonne") return;
      if (d.etape === "qc" && d.qc_sous_statut !== "a_corriger") counts.qc++;
      else if (a.columnKey === "a_corriger") counts.a_corriger++;
      else if (a.columnKey === "facturation") counts.facturation++;
      else if (a.columnKey === "juridique") counts.juridique++;
      else if (a.columnKey === "perte_totale") counts.perte_totale++;
      else if (a.columnKey === "perte_partielle") counts.perte_partielle++;
      else if (a.columnKey === "paye") counts.paye++;
      else if (a.columnKey === "paiement") {
        if (a.alert) counts.paiement_alerte++;
        else counts.paiement_calme++;
      }
    });
    return PIPELINE_BUCKETS.map((b) => ({ ...b, value: counts[b.key] })).filter((b) => b.value > 0);
  }, [actifs, now]);

  // --- Performance par opérateur ---
  const perfOperateurs = useMemo(() => {
    return profiles
      .map((p) => {
        const dossiersOp = actifs.filter((d) => d.operateur_id === p.id);
        const paiementsOp = paiements.filter((pay) => {
          const d = dossiers.find((dd) => dd.id === pay.dossier_id);
          return d?.operateur_id === p.id && inPeriode(pay.date_paiement);
        });
        const actionsOp = actions.filter((a) => a.created_by === p.id && inPeriode(a.created_at.slice(0, 10)));
        return {
          id: p.id,
          nom: p.full_name,
          montantRecupere: paiementsOp.reduce((s, x) => s + x.montant, 0),
          nbActions: actionsOp.length,
          nbActifs: dossiersOp.filter((d) => d.etape !== "paye").length,
        };
      })
      .sort((a, b) => b.montantRecupere - a.montantRecupere);
  }, [profiles, actifs, paiements, actions, dossiers, periodeStart]);

  // --- Répartition par ville / commercial (montant en jeu) ---
  function topBy(field: "ville" | "commercial") {
    const map = new Map<string, number>();
    actifs
      .filter((d) => d.etape === "paiement")
      .forEach((d) => {
        const key = d[field];
        if (!key) return;
        const reste = Math.max(0, (d.montant_facture ?? 0) - d.montant_recu);
        map.set(key, (map.get(key) ?? 0) + reste);
      });
    return Array.from(map.entries())
      .map(([label, montant]) => ({ label, montant }))
      .sort((a, b) => b.montant - a.montant)
      .slice(0, 6);
  }
  const topVilles = useMemo(() => topBy("ville"), [actifs]);
  const topCommerciaux = useMemo(() => topBy("commercial"), [actifs]);

  // --- Suivi juridique ---
  const juridiqueActifs = useMemo(() => actifs.filter((d) => d.juridique_actif), [actifs]);
  const juridiqueParEtape = useMemo(() => {
    return JURIDIQUE_ETAPES.map((e) => ({
      label: e.label,
      value: juridiqueActifs.filter((d) => (d.juridique_etape ?? "en_attente") === e.key).length,
      color: STATUS_HEX[e.color],
    })).filter((x) => x.value > 0);
  }, [juridiqueActifs]);

  if (loading) {
    return (
      <>
        <Topbar title="Analytique" description="Vue d'ensemble financière, performance et tendances" />
        <div className="px-8 py-6">
          <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Analytique" description="Vue d'ensemble financière, performance et tendances" />
      <div className="px-8 py-6">
        <div className="mb-5 flex gap-2">
          {(["30", "90", "365", "tout"] as Periode[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriode(p)}
              className={`rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                periode === p
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-surface text-ink-2 hover:bg-surface-2"
              }`}
            >
              {p === "30" ? "30 jours" : p === "90" ? "90 jours" : p === "365" ? "1 an" : "Tout"}
            </button>
          ))}
        </div>

        {/* KPIs financiers */}
        <div className="mb-7 grid grid-cols-5 gap-3.5">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Facturé (période)</div>
            <div className="mt-1.5 font-mono text-[19px] font-bold text-ink">{formatMontant(montantFacture)}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Encaissé (période)</div>
            <div className="mt-1.5 font-mono text-[19px] font-bold text-success">{formatMontant(montantEncaisse)}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Taux de recouvrement</div>
            <div className="mt-1.5 font-display text-[24px] font-bold text-ink">
              {tauxRecouvrement != null ? `${tauxRecouvrement}%` : "—"}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Perdu définitivement</div>
            <div className="mt-1.5 font-mono text-[19px] font-bold text-[#7A2E1F]">{formatMontant(montantPerduTotal)}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Encore récupérable</div>
            <div className="mt-1.5 font-mono text-[19px] font-bold text-warn">{formatMontant(montantRecuperable)}</div>
          </div>
        </div>

        <div className="mb-7 grid grid-cols-2 gap-4">
          {/* Tendance mensuelle */}
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="mb-3 font-display text-[13.5px] font-semibold text-ink">
              Tendance mensuelle — Facturé vs Encaissé
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={tendance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5B6072" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#5B6072" }} axisLine={false} tickLine={false} width={45} />
                <Tooltip
                  formatter={(v: number) => formatMontant(v)}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E3E5EA" }}
                />
                <Bar dataKey="facture" name="Facturé" fill="#9297A6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="encaisse" name="Encaissé" fill="#0E7C7B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Répartition pipeline */}
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="mb-3 font-display text-[13.5px] font-semibold text-ink">
              Répartition des dossiers actifs
            </div>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie data={pipelineData} dataKey="value" nameKey="label" innerRadius={45} outerRadius={80}>
                    {pipelineData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E3E5EA" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-1 flex-col gap-1.5">
                {pipelineData.map((b) => (
                  <div key={b.key} className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-1.5 text-ink-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: b.color }} />
                      {b.label}
                    </span>
                    <span className="font-mono font-semibold text-ink">{b.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-7 grid grid-cols-2 gap-4">
          {/* Performance équipe */}
          <div className="rounded-xl border border-border bg-surface shadow-card">
            <div className="border-b border-border px-4 py-3 font-display text-[13.5px] font-semibold text-ink">
              Performance par opérateur (période)
            </div>
            <div className="flex flex-col">
              {perfOperateurs.map((o) => (
                <div key={o.id} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-none">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-tint text-[10px] font-bold text-brand">
                    {initials(o.nom)}
                  </span>
                  <span className="flex-1 truncate text-[12.5px] font-medium text-ink">{o.nom}</span>
                  <span className="text-[11px] text-ink-3">{o.nbActions} actions</span>
                  <span className="text-[11px] text-ink-3">{o.nbActifs} actifs</span>
                  <span className="w-24 text-right font-mono text-[12.5px] font-semibold text-success">
                    {formatMontant(o.montantRecupere)}
                  </span>
                </div>
              ))}
              {perfOperateurs.length === 0 && (
                <div className="px-4 py-6 text-center text-[12.5px] text-ink-2">Aucun opérateur.</div>
              )}
            </div>
          </div>

          {/* Suivi juridique */}
          <div className="rounded-xl border border-border bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-display text-[13.5px] font-semibold text-ink">Suivi juridique</span>
              <button
                onClick={() => router.push("/juridique")}
                className="text-[11.5px] font-semibold text-brand hover:underline"
              >
                Voir tout →
              </button>
            </div>
            <div className="flex flex-col gap-1.5 px-4 py-3">
              {juridiqueParEtape.length === 0 && (
                <div className="py-4 text-center text-[12.5px] text-ink-2">Aucun dossier en contentieux.</div>
              )}
              {juridiqueParEtape.map((e) => (
                <div key={e.label} className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-1.5 text-ink-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
                    {e.label}
                  </span>
                  <span className="font-mono font-semibold text-ink">{e.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-7 grid grid-cols-2 gap-4">
          {/* Top villes */}
          <div className="rounded-xl border border-border bg-surface shadow-card">
            <div className="border-b border-border px-4 py-3 font-display text-[13.5px] font-semibold text-ink">
              Top villes — montant en jeu
            </div>
            <div className="flex flex-col">
              {topVilles.map((v) => (
                <div key={v.label} className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-none">
                  <span className="text-[12.5px] text-ink">{v.label}</span>
                  <span className="font-mono text-[12.5px] font-semibold text-ink">{formatMontant(v.montant)}</span>
                </div>
              ))}
              {topVilles.length === 0 && (
                <div className="px-4 py-6 text-center text-[12.5px] text-ink-2">Aucune donnée.</div>
              )}
            </div>
          </div>

          {/* Top commerciaux */}
          <div className="rounded-xl border border-border bg-surface shadow-card">
            <div className="border-b border-border px-4 py-3 font-display text-[13.5px] font-semibold text-ink">
              Top commerciaux — montant en jeu
            </div>
            <div className="flex flex-col">
              {topCommerciaux.map((c) => (
                <div key={c.label} className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-none">
                  <span className="text-[12.5px] text-ink">{c.label}</span>
                  <span className="font-mono text-[12.5px] font-semibold text-ink">{formatMontant(c.montant)}</span>
                </div>
              ))}
              {topCommerciaux.length === 0 && (
                <div className="px-4 py-6 text-center text-[12.5px] text-ink-2">Aucune donnée.</div>
              )}
            </div>
          </div>
        </div>

        {/* Imports */}
        {imports.length > 0 && (
          <div className="rounded-xl border border-border bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-display text-[13.5px] font-semibold text-ink">Derniers imports</span>
              <button
                onClick={() => router.push("/import")}
                className="text-[11.5px] font-semibold text-brand hover:underline"
              >
                Voir l&apos;historique →
              </button>
            </div>
            <div className="flex flex-col">
              {imports.slice(0, 5).map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-none">
                  <div>
                    <div className="text-[12.5px] font-medium text-ink">{b.libelle}</div>
                    <div className="text-[11px] text-ink-3">{new Date(b.created_at).toLocaleDateString("fr-FR")}</div>
                  </div>
                  <div className="flex gap-4 text-[11.5px] text-ink-2">
                    <span>{b.nb_nouveaux_dossiers} nouveaux</span>
                    <span className="font-mono font-semibold text-ink">{formatMontant(b.montant_total_regle)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
