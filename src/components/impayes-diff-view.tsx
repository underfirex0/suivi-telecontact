"use client";

import { AlertTriangle, FilePlus2, RefreshCw, FileWarning, UserMinus } from "lucide-react";
import { formatMontant } from "@/lib/utils";
import { impayesDiffKpis, type ImpayesDiff } from "@/lib/impayes";
import { SOCIETE_LABELS, SUPPORT_LABELS, impayeTypeLabel, editionTab } from "@/lib/tags";

const TH = "border-b border-border px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-ink-2";

export function ImpayesDiffView({ diff }: { diff: ImpayesDiff }) {
  const k = impayesDiffKpis(diff);

  return (
    <div>
      <div className="mb-6 grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Nouveaux impayés</div>
          <div className="mt-1.5 font-display text-[24px] font-bold text-ink">{k.nbNouveaux}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Reste dû (nouveaux)</div>
          <div className="mt-1.5 font-mono text-[18px] font-bold text-ink">{formatMontant(k.montantNouveaux)}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Mis à jour</div>
          <div className="mt-1.5 font-display text-[24px] font-bold text-brand">{k.nbMisesAJour}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Absents du fichier</div>
          <div className="mt-1.5 font-display text-[24px] font-bold text-warn">{k.nbAbsents}</div>
        </div>
      </div>

      {diff.nouveaux.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 font-display text-[13.5px] font-semibold text-ink">
            <FilePlus2 size={15} className="text-brand" />
            Nouveaux impayés ({diff.nouveaux.length})
          </div>
          <div className="max-h-[420px] overflow-auto rounded-xl border border-border bg-surface shadow-card">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-surface-2">
                <tr>
                  {["Dossier", "Client", "Agent", "Type", "Classement", "Impayé le", "Reste dû"].map((h) => (
                    <th key={h} className={TH}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {diff.nouveaux.map((r) => (
                  <tr key={r.numeroDossier} className="border-b border-border last:border-none">
                    <td className="px-3 py-2 font-mono text-[12px] text-ink-2">{r.numeroDossier}</td>
                    <td className="px-3 py-2 text-[12.5px] font-semibold text-ink">{r.client}</td>
                    <td className="px-3 py-2 text-[12px] text-ink-2">{r.agent ?? "—"}</td>
                    <td className="px-3 py-2 text-[12px] text-ink-2">{impayeTypeLabel(r.type)}</td>
                    <td className="px-3 py-2 text-[11.5px] text-ink-2">
                      {r.societe === "autre" ? `Autre (Ste ${r.steCode ?? "?"})` : SOCIETE_LABELS[r.societe]} ·{" "}
                      {r.edition != null ? editionTab(r.edition) : "sans éd."} · {SUPPORT_LABELS[r.support]}
                    </td>
                    <td className="px-3 py-2 font-mono text-[12px] text-ink-2">{r.dateImpaye ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-[12px] font-semibold text-ink">{formatMontant(r.reste)}</td>
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
            Mises à jour ({diff.misesAJour.length}) — argent et identité uniquement, le traitement n&apos;est jamais écrasé
          </div>
          <div className="flex flex-col gap-2">
            {diff.misesAJour.map((m) => (
              <div key={m.impayeId} className="rounded-xl border border-border bg-surface p-3.5 shadow-card">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">{m.client}</span>
                  <span className="font-mono text-[11px] text-ink-3">Dossier {m.numeroDossier}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {m.champs.map((c, j) => (
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

      {diff.absents.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 font-display text-[13.5px] font-semibold text-warn">
            <UserMinus size={15} />
            Ne figurent plus dans le fichier ({diff.absents.length}) — {formatMontant(k.montantAbsents)}
          </div>
          <div className="max-h-[260px] overflow-auto rounded-xl border border-warn/30 bg-warn-tint/40">
            {diff.absents.map((a) => (
              <div
                key={a.impayeId}
                className="flex items-center justify-between border-b border-warn/20 px-4 py-2 text-[12.5px] last:border-none"
              >
                <span className="text-ink">
                  <strong>{a.client}</strong> <span className="text-ink-3">· dossier {a.numeroDossier}</span>
                  {a.agent && <span className="text-ink-3"> · {a.agent}</span>}
                </span>
                <span className="font-mono font-semibold text-ink">{formatMontant(a.reste)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {diff.anomalies.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 font-display text-[13.5px] font-semibold text-danger">
            <FileWarning size={15} />
            À noter ({diff.anomalies.length})
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

      {diff.nouveaux.length === 0 && diff.misesAJour.length === 0 && diff.absents.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface py-10 text-center text-[13px] text-ink-2">
          Rien à changer — ce fichier correspond exactement à ce qui est déjà dans l&apos;application.
        </div>
      )}
    </div>
  );
}
