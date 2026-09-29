"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, parseISO, subDays } from "date-fns";
import { TagBadges } from "@/components/tag-badges";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { SOCIETE_COLORS, SOCIETE_SHORT, editionTab } from "@/lib/tags";
import { formatDate, formatMontant, initials } from "@/lib/utils";
import type { Dossier, Profile } from "@/lib/types";

type Periode = "30" | "90" | "365" | "tout";
type SortMode = "recent" | "montant" | "delai";

export function PayesView({ dossiers, profiles }: { dossiers: Dossier[]; profiles: Profile[] }) {
  const router = useRouter();
  const [periode, setPeriode] = useState<Periode>("90");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p.full_name])), [profiles]);

  const payes = useMemo(() => dossiers.filter((d) => d.etape === "paye"), [dossiers]);

  const periodeStart = useMemo(() => {
    if (periode === "tout") return null;
    return subDays(new Date(), Number(periode));
  }, [periode]);

  const enPeriode = useMemo(
    () =>
      payes.filter((d) => {
        if (!periodeStart) return true;
        if (!d.date_paiement) return false;
        return parseISO(d.date_paiement) >= periodeStart;
      }),
    [payes, periodeStart]
  );

  // Délai de paiement = jours entre la date de facture et la date de paiement (les deux nécessaires)
  const delais = useMemo(
    () =>
      enPeriode
        .filter((d) => d.date_facture && d.date_paiement)
        .map((d) => Math.max(0, differenceInCalendarDays(parseISO(d.date_paiement!), parseISO(d.date_facture!)))),
    [enPeriode]
  );
  const delaiMoyen = delais.length > 0 ? Math.round(delais.reduce((s, x) => s + x, 0) / delais.length) : null;

  const montantTotal = enPeriode.reduce((s, d) => s + (d.montant_facture ?? d.montant_recu), 0);
  const montantMoyen = enPeriode.length > 0 ? montantTotal / enPeriode.length : 0;

  // Répartition par édition (sur la période)
  const parEdition = useMemo(() => {
    const map = new Map<
      string,
      { key: string; societe: Dossier["societe"]; edition: number | null; nb: number; montant: number }
    >();
    enPeriode.forEach((d) => {
      const key = `${d.societe}|${d.edition ?? "none"}`;
      const cur = map.get(key) ?? { key, societe: d.societe, edition: d.edition, nb: 0, montant: 0 };
      cur.nb += 1;
      cur.montant += d.montant_facture ?? d.montant_recu;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.societe !== b.societe) return a.societe.localeCompare(b.societe);
      return (b.edition ?? -1) - (a.edition ?? -1);
    });
  }, [enPeriode]);

  const sorted = useMemo(() => {
    const list = [...enPeriode];
    if (sortMode === "montant") {
      list.sort((a, b) => (b.montant_facture ?? b.montant_recu) - (a.montant_facture ?? a.montant_recu));
    } else if (sortMode === "delai") {
      const delai = (d: Dossier) =>
        d.date_facture && d.date_paiement
          ? differenceInCalendarDays(parseISO(d.date_paiement), parseISO(d.date_facture))
          : -1;
      list.sort((a, b) => delai(b) - delai(a));
    } else {
      list.sort((a, b) => (b.date_paiement ?? "").localeCompare(a.date_paiement ?? ""));
    }
    return list;
  }, [enPeriode, sortMode]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
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
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="ml-auto w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Plus récents d&apos;abord</SelectItem>
            <SelectItem value="montant">Plus gros montants</SelectItem>
            <SelectItem value="delai">Délai le plus long</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Encaissé (période)</div>
          <div className="mt-1.5 font-mono text-[19px] font-bold text-success">{formatMontant(montantTotal)}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Dossiers payés</div>
          <div className="mt-1.5 font-display text-[22px] font-bold text-ink">{enPeriode.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Délai moyen de paiement</div>
          <div className="mt-1.5 font-display text-[22px] font-bold text-ink">
            {delaiMoyen != null ? `${delaiMoyen} j` : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Montant moyen</div>
          <div className="mt-1.5 font-mono text-[19px] font-bold text-ink">{formatMontant(montantMoyen)}</div>
        </div>
      </div>

      {/* Répartition par édition */}
      {parEdition.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {parEdition.map((e) => (
            <div
              key={e.key}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 shadow-card"
            >
              <span
                className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                style={{ backgroundColor: `${SOCIETE_COLORS[e.societe]}1A`, color: SOCIETE_COLORS[e.societe] }}
              >
                {SOCIETE_SHORT[e.societe]}
              </span>
              <span className="text-[12.5px] font-semibold text-ink">
                {e.edition != null ? editionTab(e.edition) : "Sans édition"}
              </span>
              <span className="font-mono text-[11.5px] text-ink-2">× {e.nb}</span>
              <span className="font-mono text-[12.5px] font-bold text-success">{formatMontant(e.montant)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Liste */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface py-12 text-center text-[13px] text-ink-2">
          Aucun dossier payé sur cette période.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-2">
                {["Client", "Classement", "Facturé", "Facture", "Payé le", "Délai", "Opérateur"].map((h) => (
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
              {sorted.map((d) => {
                const operateurName = d.operateur_id ? profileMap.get(d.operateur_id) : null;
                const delai =
                  d.date_facture && d.date_paiement
                    ? differenceInCalendarDays(parseISO(d.date_paiement), parseISO(d.date_facture))
                    : null;
                return (
                  <tr
                    key={d.id}
                    onClick={() => router.push(`/dossiers/${d.id}`)}
                    className="cursor-pointer border-b border-border transition-colors last:border-none hover:bg-surface-2"
                  >
                    <td className="px-3.5 py-3 text-[13px] font-semibold text-ink">{d.client_nom}</td>
                    <td className="px-3.5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <TagBadges d={d} />
                      </div>
                    </td>
                    <td className="px-3.5 py-3 font-mono text-[12.5px] font-semibold text-success">
                      {formatMontant(d.montant_facture ?? d.montant_recu)}
                    </td>
                    <td className="px-3.5 py-3 text-[12px] text-ink-2">{d.numero_facture ?? "—"}</td>
                    <td className="px-3.5 py-3 font-mono text-[12.5px] text-ink-2">{formatDate(d.date_paiement)}</td>
                    <td className="px-3.5 py-3 font-mono text-[12.5px] text-ink-2">
                      {delai != null ? `${delai} j` : "—"}
                    </td>
                    <td className="px-3.5 py-3 text-[13px] text-ink-2">
                      {operateurName ? (
                        <span className="flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-tint text-[9px] font-bold text-brand">
                            {initials(operateurName)}
                          </span>
                          {operateurName}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
