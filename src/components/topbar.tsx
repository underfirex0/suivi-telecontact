"use client";

import { Search } from "lucide-react";

export function Topbar({
  title,
  description,
  search,
  onSearchChange,
}: {
  title: string;
  description: string;
  search?: string;
  onSearchChange?: (value: string) => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg/90 px-8 py-4 backdrop-blur-sm">
      <div>
        <h1 className="font-display text-[19px] font-semibold text-ink">{title}</h1>
        <p className="mt-0.5 text-[12.5px] text-ink-2">{description}</p>
      </div>
      {onSearchChange && (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher un client..."
            className="w-64 rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      )}
    </div>
  );
}
