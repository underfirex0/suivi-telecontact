"use client";

import { AlertTriangle, CheckCircle2, TrendingUp, FileWarning, RefreshCw } from "lucide-react";
import { formatMontant } from "@/lib/utils";
import type { ImportDiff } from "@/lib/import-diff";
import { diffKpis } from "@/lib/import-diff";

export function ImportDiffView({ diff }: { diff: ImportDiff }) {
  const { nbNouveaux, nbSoldes, nbPartiels, nbMisesAJour, montantTotalRegle } = diffKpis(diff);

  return (
    <div>
      <div className="mb-6 grid grid-cols-5 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Nouveaux dossiers</div>
          <div className="mt-1.5 font-display text-[24px] font-bold text-ink">{nbNouveaux}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Désormais soldés</div>
          <div className="mt-1.5 font-display text-[24px] font-bold text-success">{nbSoldes}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Paiements partiels</div>
          <div className="mt-1.5 font-display text-[24px] font-bold text-warn">{nbPartiels}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Champs mis à jour</div>
          <div className="mt-1.5 font-display text-[24px] font-bold text-brand">{nbMisesAJour}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Montant total réglé</div>
          <div className="mt-1.5 font-mono text-[18px] font-bold text-ink">{formatMontant(montantTotalRegle)}</div>
        </div>
      </div>

      {diff.nouveaux.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 font-display text-[13.5px] font-semibold text-ink">
            <TrendingUp size={15} className="text-brand" />
            Nouveaux dossiers ({diff.nouveaux.length})
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-2">
                  {["Client", "Ville", "N° facture", "Montant facturé", "Reçu", "Statut", "Source"].map((h) => (
                    <th
                      key={h}
                      className="border-b border-border px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-ink-2"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {diff.nouveaux.map((n, i) => (
                  <tr key={i} className="border-b border-border last:border-none">
                    <td className="px-3 py-2 text-[12.5px] font-semibold text-ink">{n.client}</td>
                    <td className="px-3 py-2 text-[12px] text-ink-2">{n.ville ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-[12px] text-ink-2">{n.numeroFacture}</td>
                    <td className="px-3 py-2 font-mono text-[12px] text-ink-2">{formatMontant(n.montantFacture)}</td>
                    <td className="px-3 py-2 font-mono text-[12px] text-ink-2">{formatMontant(n.montantRecu)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                          n.paye ? "bg-success-tint text-success" : "bg-neutral-tint text-neutral"
                        }`}
                      >
                        {n.paye ? "Payé" : "En attente"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-ink-3">
                      {n.source === "reglement_seul" ? "Règlement uniquement (estimé)" : "En instance"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {diff.paiementsExistants.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 font-display text-[13.5px] font-semibold text-ink">
            <CheckCircle2 size={15} className="text-success" />
            Paiements sur dossiers existants ({diff.paiementsExistants.length})
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-2">
                  {["Client", "N° facture", "Ajouté", "Ancien reçu", "Nouveau total", "Solde après", "Résultat", "Source"].map(
                    (h) => (
                      <th
                        key={h}
                        className="border-b border-border px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-ink-2"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {diff.paiementsExistants.map((p, i) => (
                  <tr key={i} className="border-b border-border last:border-none">
                    <td className="px-3 py-2 text-[12.5px] font-semibold text-ink">{p.client}</td>
                    <td className="px-3 py-2 font-mono text-[12px] text-ink-2">{p.numeroFacture}</td>
                    <td className="px-3 py-2 font-mono text-[12px] font-semibold text-success">
                      +{formatMontant(p.montantAjoute)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[12px] text-ink-2">{formatMontant(p.ancienRecu)}</td>
                    <td className="px-3 py-2 font-mono text-[12px] text-ink-2">{formatMontant(p.nouveauTotal)}</td>
                    <td className="px-3 py-2 font-mono text-[12px] text-ink-2">{formatMontant(p.soldeApres)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                          p.devientPaye ? "bg-success-tint text-success" : "bg-warn-tint text-warn"
                        }`}
                      >
                        {p.devientPaye ? "Soldé" : "Partiel"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-ink-3">
                      {p.source === "ecart_en_instance" ? "Écart 'en instance' (sans ligne de règlement)" : "Règlement"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {diff.misesAJour.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 font-display text-[13.5px] font-semibold text-brand">
            <RefreshCw size={15} />
            Mises à jour sur dossiers existants ({diff.misesAJour.length} dossier{diff.misesAJour.length > 1 ? "s" : ""})
          </div>
          <div className="flex flex-col gap-2">
            {diff.misesAJour.map((maj, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface p-3.5 shadow-card">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">{maj.client}</span>
                  <span className="font-mono text-[11px] text-ink-3">Facture {maj.numeroFacture}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {maj.champs.map((c, j) => (
                    <div key={j} className="flex items-center gap-2 text-[12px]">
                      <span className="w-36 flex-shrink-0 font-semibold text-ink-2">{c.champ}</span>
                      <span className="text-ink-3 line-through">{c.ancien}</span>
                      <span className="text-ink-3">→</span>
                      <span className="font-semibold text-brand">{c.nouveau}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {diff.anomalies.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 font-display text-[13.5px] font-semibold text-danger">
            <FileWarning size={15} />
            Anomalies ({diff.anomalies.length})
          </div>
          <div className="flex flex-col gap-1.5">
            {diff.anomalies.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-tint px-3 py-2 text-[12px] text-danger"
              >
                <AlertTriangle size={13} />
                <strong>{a.ligne}</strong> — {a.raison}
              </div>
            ))}
          </div>
        </div>
      )}

      {diff.nouveaux.length === 0 &&
        diff.paiementsExistants.length === 0 &&
        diff.misesAJour.length === 0 &&
        diff.anomalies.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface py-10 text-center text-[13px] text-ink-2">
            Rien à importer — aucune ligne exploitable trouvée dans ce fichier.
          </div>
        )}
    </div>
  );
}
