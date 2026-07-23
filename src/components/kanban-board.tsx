"use client";

import { useRouter } from "next/navigation";
import { Badge, Dot } from "@/components/ui/badge";
import { analyzeDossier, KANBAN_COLUMNS } from "@/lib/dossier-logic";
import type { Dossier } from "@/lib/types";

export function KanbanBoard({ dossiers }: { dossiers: Dossier[] }) {
  const router = useRouter();
  const analyzed = dossiers.map((d) => ({ d, a: analyzeDossier(d) }));

  return (
    <div className="flex gap-3.5 overflow-x-auto pb-3">
      {KANBAN_COLUMNS.map((col) => {
        const items = analyzed
          .filter((x) => x.a.columnKey === col.key)
          .sort((x, y) => y.a.severity - x.a.severity);

        return (
          <div key={col.key} className="w-[260px] flex-shrink-0 rounded-xl bg-surface-2 p-3">
            <div className="mb-2.5 flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 font-display text-[12.5px] font-bold text-ink">
                <Dot color={col.dot} />
                {col.title}
              </div>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                {items.length}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {items.length === 0 && (
                <div className="py-4 text-center text-[11.5px] text-ink-3">Aucun dossier</div>
              )}
              {items.map(({ d, a }) => (
                <button
                  key={d.id}
                  onClick={() => router.push(`/dossiers/${d.id}`)}
                  style={{
                    borderLeftColor:
                      a.color === "warning"
                        ? "#C2790A"
                        : a.color === "danger"
                        ? "#C0392B"
                        : a.color === "juridique"
                        ? "#5B3A8E"
                        : a.color === "success"
                        ? "#1F8A55"
                        : "#6B7280",
                  }}
                  className="rounded-lg border-l-[3px] bg-surface p-3 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-lg"
                >
                  <div className="truncate text-[13px] font-semibold text-ink">{d.client_nom}</div>
                  <div className="mb-2 truncate text-[11.5px] text-ink-2">{d.offre || "—"}</div>
                  <div className="flex items-center justify-between gap-2">
                    <Badge color={a.color}>{a.label.length > 18 ? a.label.slice(0, 16) + "…" : a.label}</Badge>
                    <span className="whitespace-nowrap font-mono text-[10.5px] text-ink-3">{a.sub}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
