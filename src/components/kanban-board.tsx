"use client";

import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Wrench,
  Receipt,
  Wallet,
  Scale,
  CheckCircle2,
  Clock,
  Inbox,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { analyzeDossier, KANBAN_COLUMNS } from "@/lib/dossier-logic";
import { useNow } from "@/lib/use-now";
import { initials } from "@/lib/utils";
import type { Dossier, Profile, StatusColor } from "@/lib/types";

const COLUMN_ICONS: Record<string, typeof ClipboardCheck> = {
  qc: ClipboardCheck,
  a_corriger: Wrench,
  facturation: Receipt,
  paiement: Wallet,
  juridique: Scale,
  paye: CheckCircle2,
};

const HEX: Record<StatusColor, string> = {
  neutral: "#6B7280",
  warning: "#C2790A",
  danger: "#C0392B",
  juridique: "#5B3A8E",
  success: "#1F8A55",
};

export function KanbanBoard({
  dossiers,
  profiles,
  onlyAlerts = false,
}: {
  dossiers: Dossier[];
  profiles: Profile[];
  onlyAlerts?: boolean;
}) {
  const router = useRouter();
  const now = useNow();
  const analyzed = dossiers.map((d) => ({ d, a: analyzeDossier(d, now) }));

  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name]));

  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {KANBAN_COLUMNS.map((col) => {
        let items = analyzed
          .filter((x) => x.a.columnKey === col.key)
          .sort((x, y) => y.a.severity - x.a.severity);

        if (onlyAlerts) items = items.filter((x) => x.a.alert);

        const alertCount = items.filter((x) => x.a.alert).length;
        const Icon = COLUMN_ICONS[col.key] ?? Inbox;

        return (
          <div key={col.key} className="w-[288px] flex-shrink-0 rounded-xl bg-surface-2 p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${HEX[col.dot]}1A`, color: HEX[col.dot] }}
                >
                  <Icon size={13} strokeWidth={2.4} />
                </div>
                <span className="font-display text-[13px] font-bold text-ink">{col.title}</span>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={
                  alertCount > 0
                    ? { backgroundColor: "#FBEAE8", color: "#C0392B" }
                    : { backgroundColor: "#fff", color: "#5B6072" }
                }
              >
                {items.length}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {items.length === 0 && (
                <div className="flex flex-col items-center gap-1.5 py-7 text-center text-[11.5px] text-ink-3">
                  <Inbox size={16} className="opacity-40" />
                  {onlyAlerts ? "Rien à signaler" : "Aucun dossier"}
                </div>
              )}
              {items.map(({ d, a }) => {
                const operateurName = d.operateur_id ? profileMap.get(d.operateur_id) : null;
                return (
                  <button
                    key={d.id}
                    onClick={() => router.push(`/dossiers/${d.id}`)}
                    style={{ borderLeftColor: HEX[a.color] }}
                    className="rounded-lg border-l-4 border-y border-r border-border bg-surface p-3.5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-lg"
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-semibold leading-tight text-ink">
                          {d.client_nom}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-ink-2">{d.offre || "—"}</div>
                      </div>
                      {operateurName && (
                        <div
                          title={operateurName}
                          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-tint text-[10px] font-bold text-brand"
                        >
                          {initials(operateurName)}
                        </div>
                      )}
                    </div>

                    <Badge color={a.color} className="mb-1.5">
                      {a.label}
                    </Badge>

                    {a.sub && (
                      <div className="flex items-center gap-1 font-mono text-[10.5px] text-ink-3">
                        <Clock size={10} />
                        {a.sub}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
