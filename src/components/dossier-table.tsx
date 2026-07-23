"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { analyzeDossier } from "@/lib/dossier-logic";
import { formatDate, formatMontant } from "@/lib/utils";
import { exportDossiersToCsv } from "@/lib/export-csv";
import { useNow } from "@/lib/use-now";
import type { Dossier, Profile } from "@/lib/types";

export function DossierTable({ dossiers, profiles }: { dossiers: Dossier[]; profiles: Profile[] }) {
  const router = useRouter();
  const [etapeFilter, setEtapeFilter] = useState("all");
  const [alerteFilter, setAlerteFilter] = useState("all");
  const now = useNow();

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, p.full_name));
    return m;
  }, [profiles]);

  const analyzed = useMemo(() => {
    let list = dossiers.map((d) => ({ d, a: analyzeDossier(d, now) }));
    if (etapeFilter !== "all") list = list.filter((x) => x.d.etape === etapeFilter);
    if (alerteFilter === "late") list = list.filter((x) => x.a.alert);
    list.sort((x, y) => y.a.severity - x.a.severity);
    return list;
  }, [dossiers, etapeFilter, alerteFilter, now]);

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between gap-2.5">
        <div className="flex gap-2.5">
          <Select value={etapeFilter} onValueChange={setEtapeFilter}>
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les étapes</SelectItem>
              <SelectItem value="qc">Contrôle qualité</SelectItem>
              <SelectItem value="facturation">À facturer</SelectItem>
              <SelectItem value="paiement">Paiement</SelectItem>
              <SelectItem value="paye">Payé</SelectItem>
            </SelectContent>
          </Select>
          <Select value={alerteFilter} onValueChange={setAlerteFilter}>
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="late">En retard uniquement</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="secondary"
          onClick={() => exportDossiersToCsv(analyzed.map((x) => x.d), profiles)}
        >
          <Download size={14} />
          Exporter CSV ({analyzed.length})
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-2">
              {["Client", "Offre", "Statut", "Date BC", "Montant", "Opérateur", "Détail"].map((h) => (
                <th
                  key={h}
                  className="border-b border-border px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-2"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analyzed.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[13px] text-ink-3">
                  Aucun dossier
                </td>
              </tr>
            )}
            {analyzed.map(({ d, a }) => (
              <tr
                key={d.id}
                onClick={() => router.push(`/dossiers/${d.id}`)}
                className="cursor-pointer border-b border-border transition-colors last:border-none hover:bg-surface-2"
              >
                <td className="px-3.5 py-3 text-[13px] font-semibold text-ink">{d.client_nom}</td>
                <td className="px-3.5 py-3 text-[13px] text-ink-2">{d.offre || "—"}</td>
                <td className="px-3.5 py-3">
                  <Badge color={a.color}>{a.label}</Badge>
                </td>
                <td className="px-3.5 py-3 font-mono text-[12.5px] text-ink-2">{formatDate(d.date_bc)}</td>
                <td className="px-3.5 py-3 font-mono text-[12.5px] text-ink-2">
                  {formatMontant(d.montant_facture)}
                </td>
                <td className="px-3.5 py-3 text-[13px] text-ink-2">
                  {d.operateur_id ? profileMap.get(d.operateur_id) ?? "—" : "—"}
                </td>
                <td className="px-3.5 py-3 text-[12.5px] text-ink-2">{a.sub || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
