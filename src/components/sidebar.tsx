"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Kanban, Users, Plus } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { useDossiers } from "@/components/providers/dossiers-provider";

const navItems = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/dossiers", label: "Dossiers", icon: Kanban },
  { href: "/operateurs", label: "Opérateurs", icon: Users },
];

export function Sidebar({ onNewDossier }: { onNewDossier: () => void }) {
  const pathname = usePathname();
  const { dossiers, currentProfile, signOut } = useDossiers();
  const activeCount = dossiers.filter((d) => d.etape !== "paye").length;

  return (
    <aside className="flex w-[220px] flex-shrink-0 flex-col bg-sidebar px-3.5 py-5 text-sidebar-text">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-[#12A5A3] font-display text-[15px] font-bold text-white">
          T
        </div>
        <div className="leading-tight">
          <div className="font-display text-[14.5px] font-semibold text-white">Suivi Référencement</div>
          <div className="text-[10.5px] tracking-wide text-sidebar-text">Telecontact / Edicom</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                active ? "bg-brand text-white" : "text-sidebar-text hover:bg-sidebar-2 hover:text-white"
              )}
            >
              <Icon size={16} className={active ? "opacity-100" : "opacity-80"} />
              {item.label}
              {item.href === "/dossiers" && (
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                    active ? "bg-white/15 text-white" : "bg-white/10 text-white"
                  )}
                >
                  {activeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 px-2 text-[10px] font-semibold uppercase tracking-wider text-[#585D70]">
        Actions
      </div>
      <button
        onClick={onNewDossier}
        className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-brand px-3.5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-dark"
      >
        <Plus size={15} />
        Nouveau dossier
      </button>

      <div className="mt-auto border-t border-sidebar-2 pt-3.5">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-sidebar-2"
        >
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
            {initials(currentProfile?.full_name)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-semibold text-white">
              {currentProfile?.full_name ?? "..."}
            </div>
            <div className="text-[10px] text-sidebar-text">Se déconnecter</div>
          </div>
        </button>
      </div>
    </aside>
  );
}
