"use client";

import { Globe, BookOpen } from "lucide-react";
import { useScope } from "@/components/providers/scope-provider";
import { SOCIETE_COLORS, SOCIETE_SHORT, editionBadge } from "@/lib/tags";
import type { Dossier } from "@/lib/types";

/**
 * Étiquettes d'un dossier : [société] · édition · support.
 * La société n'est affichée que lorsqu'on regarde "toutes les sociétés"
 * (sinon elle est déjà évidente grâce à la barre de navigation).
 */
export function TagBadges({ d }: { d: Pick<Dossier, "societe" | "support" | "edition"> }) {
  const { scope } = useScope();
  const color = SOCIETE_COLORS[d.societe];
  return (
    <>
      {scope.societe === "all" && (
        <span
          className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
          style={{ backgroundColor: `${color}1A`, color }}
        >
          {SOCIETE_SHORT[d.societe]}
        </span>
      )}
      <span
        className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
          d.edition == null ? "bg-warn-tint text-warn" : "bg-surface-2 text-ink-2"
        }`}
      >
        {editionBadge(d.edition)}
      </span>
      {d.support === "papier" ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF0FB] px-2 py-0.5 text-[10.5px] font-semibold text-[#3B4CB8]">
          <BookOpen size={10} />
          Papier
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-[10.5px] font-semibold text-brand">
          <Globe size={10} />
          Web
        </span>
      )}
    </>
  );
}
