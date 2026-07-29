"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, PhoneCall, Ban, PartyPopper, X, MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ActionLogDialog } from "@/components/action-log-dialog";
import { AbandonDialog } from "@/components/abandon-dialog";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { analyzeDossier, scoreFileAction } from "@/lib/dossier-logic";
import { useNow } from "@/lib/use-now";
import { formatMontant, initials, cn } from "@/lib/utils";
import { STATUS_HEX } from "@/lib/status-colors";
import type { Dossier, Profile, ColumnKey, ActionEntry } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  appel: "Appel",
  email: "Email",
  visite: "Visite",
  promesse_paiement: "Promesse",
  autre: "Autre",
};

type Chip = "perte_totale" | "perte_partielle" | "promesse_rompue" | "desync" | "juridique" | "non_assigne";

const CHIP_LABELS: Record<Chip, string> = {
  perte_totale: "Perte totale",
  perte_partielle: "Perte récupérable",
  promesse_rompue: "Promesse non tenue",
  desync: "Désynchronisation",
  juridique: "Suivi juridique",
  non_assigne: "Non assigné",
};

type SortMode = "priorite" | "montant" | "jours" | "client";

export function FileAction({ dossiers, profiles }: { dossiers: Dossier[]; profiles: Profile[] }) {
  const router = useRouter();
  const now = useNow();
  const { addAction, claimDossier, abandonDossier, currentProfile, fetchAllActions } = useDossiers();
  const [actionDossier, setActionDossier] = useState<Dossier | null>(null);
  const [abandonDossierTarget, setAbandonDossierTarget] = useState<Dossier | null>(null);
  const [lastActionByDossier, setLastActionByDossier] = useState<Map<string, ActionEntry>>(new Map());

  const [activeChips, setActiveChips] = useState<Set<Chip>>(new Set());
  const [operateurFilter, setOperateurFilter] = useState("all");
  const [villeFilter, setVilleFilter] = useState("all");
  const [montantMin, setMontantMin] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("priorite");

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p.full_name])), [profiles]);

  async function loadLastActions() {
    const all = await fetchAllActions();
    const map = new Map<string, ActionEntry>();
    for (const act of all) {
      if (!map.has(act.dossier_id)) map.set(act.dossier_id, act); // déjà triées du plus récent au plus ancien
    }
    setLastActionByDossier(map);
  }

  useEffect(() => {
    loadLastActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const villes = useMemo(() => {
    const set = new Set<string>();
    dossiers.forEach((d) => d.ville && set.add(d.ville));
    return Array.from(set).sort();
  }, [dossiers]);

  const allItems = useMemo(() => {
    return dossiers
      .filter((d) => d.etape === "paiement")
      .map((d) => ({ d, a: analyzeDossier(d, now) }))
      .filter((x) => x.a.alert);
  }, [dossiers, now]);

  function toggleChip(chip: Chip) {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });
  }

  function matchesChip(columnKey: ColumnKey, promesseRompue: boolean, desyncRisque: boolean): boolean {
    if (activeChips.size === 0) return true;
    if (activeChips.has("perte_totale") && columnKey === "perte_totale") return true;
    if (activeChips.has("perte_partielle") && columnKey === "perte_partielle") return true;
    if (activeChips.has("promesse_rompue") && promesseRompue) return true;
    if (activeChips.has("desync") && desyncRisque) return true;
    if (activeChips.has("juridique") && columnKey === "juridique") return true;
    return false;
  }

  const items = useMemo(() => {
    let list = allItems.filter(({ d, a }) => {
      if (activeChips.has("non_assigne") && d.operateur_id) return false;
      if (!matchesChip(a.columnKey, a.promesseRompue, a.desyncRisque)) return false;
      if (operateurFilter === "moi" && d.operateur_id !== currentProfile?.id) return false;
      if (operateurFilter !== "all" && operateurFilter !== "moi" && d.operateur_id !== operateurFilter) return false;
      if (villeFilter !== "all" && d.ville !== villeFilter) return false;
      const reste = Math.max(0, (d.montant_facture ?? 0) - d.montant_recu);
      if (montantMin && reste < Number(montantMin)) return false;
      return true;
    });

    list = list.sort((x, y) => {
      if (sortMode === "montant") {
        const rx = Math.max(0, (x.d.montant_facture ?? 0) - x.d.montant_recu);
        const ry = Math.max(0, (y.d.montant_facture ?? 0) - y.d.montant_recu);
        return ry - rx;
      }
      if (sortMode === "jours") {
        return (y.a.joursSansAction ?? 0) - (x.a.joursSansAction ?? 0);
      }
      if (sortMode === "client") {
        return x.d.client_nom.localeCompare(y.d.client_nom);
      }
      return scoreFileAction(y.d, y.a) - scoreFileAction(x.d, x.a);
    });

    return list;
  }, [allItems, activeChips, operateurFilter, villeFilter, montantMin, sortMode, currentProfile]);

  const hasActiveFilters =
    activeChips.size > 0 || operateurFilter !== "all" || villeFilter !== "all" || !!montantMin;

  function resetFilters() {
    setActiveChips(new Set());
    setOperateurFilter("all");
    setVilleFilter("all");
    setMontantMin("");
  }

  return (
    <div>
      {/* Barre de filtres intelligents */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(Object.keys(CHIP_LABELS) as Chip[]).map((chip) => (
          <button
            key={chip}
            onClick={() => toggleChip(chip)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
              activeChips.has(chip)
                ? "border-brand bg-brand text-white"
                : "border-border bg-surface text-ink-2 hover:bg-surface-2"
            )}
          >
            {CHIP_LABELS[chip]}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <Select value={operateurFilter} onValueChange={setOperateurFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les opérateurs</SelectItem>
            {currentProfile && <SelectItem value="moi">Mes dossiers</SelectItem>}
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {villes.length > 0 && (
          <Select value={villeFilter} onValueChange={setVilleFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les villes</SelectItem>
              {villes.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Input
          type="number"
          placeholder="Montant min (MAD)"
          value={montantMin}
          onChange={(e) => setMontantMin(e.target.value)}
          className="w-[160px]"
        />

        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priorite">Trier par priorité</SelectItem>
            <SelectItem value="montant">Trier par montant</SelectItem>
            <SelectItem value="jours">Trier par jours sans action</SelectItem>
            <SelectItem value="client">Trier par client (A-Z)</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-[12px] font-semibold text-ink-2 hover:text-danger"
          >
            <X size={13} />
            Réinitialiser
          </button>
        )}

        <span className="ml-auto text-[12px] text-ink-2">
          {items.length} sur {allItems.length} dossier{allItems.length > 1 ? "s" : ""}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface py-12 text-center text-ink-2">
          <PartyPopper size={22} className="text-success" />
          <div className="font-display text-[15px] font-semibold text-ink">
            {allItems.length === 0 ? "File d'action vide" : "Aucun résultat pour ces filtres"}
          </div>
          <div className="text-[13px]">
            {allItems.length === 0
              ? "Aucun dossier ne nécessite d'action pour le moment."
              : "Essayez de réinitialiser les filtres."}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map(({ d, a }) => {
            const reste = Math.max(0, (d.montant_facture ?? 0) - d.montant_recu);
            const operateurName = d.operateur_id ? profileMap.get(d.operateur_id) : null;
            return (
              <div
                key={d.id}
                className="rounded-xl border border-border bg-surface p-4 shadow-card border-l-4"
                style={{ borderLeftColor: STATUS_HEX[a.color] }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => router.push(`/dossiers/${d.id}`)}>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge color={a.color}>{a.label}</Badge>
                      {!operateurName && (
                        <span className="rounded-full bg-warn-tint px-2 py-0.5 text-[10.5px] font-bold text-warn">
                          Non assigné
                        </span>
                      )}
                      {d.ville && (
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-ink-2">
                          {d.ville}
                        </span>
                      )}
                    </div>
                    <div className="text-[14px] font-semibold text-ink">{d.client_nom}</div>
                    <div className="text-[12px] text-ink-2">{d.offre || "—"}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
                      <span>
                        {a.joursSansAction != null && a.joursSansAction > 0
                          ? `${a.joursSansAction}j sans action`
                          : "Aucune action enregistrée"}
                      </span>
                      {d.prochain_rappel && <span>Rappel prévu le {d.prochain_rappel}</span>}
                      {operateurName && (
                        <span className="flex items-center gap-1.5">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-tint text-[8.5px] font-bold text-brand">
                            {initials(operateurName)}
                          </span>
                          {operateurName}
                        </span>
                      )}
                    </div>
                    {lastActionByDossier.has(d.id) && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-surface-2 px-2.5 py-2 text-[11.5px] text-ink-2">
                        <MessageSquareText size={13} className="mt-0.5 flex-shrink-0 text-ink-3" />
                        <div>
                          <span className="font-semibold text-ink">
                            {TYPE_LABELS[lastActionByDossier.get(d.id)!.type] ?? lastActionByDossier.get(d.id)!.type}
                          </span>
                          {lastActionByDossier.get(d.id)!.resultat && (
                            <span> — {lastActionByDossier.get(d.id)!.resultat}</span>
                          )}
                          <span className="text-ink-3">
                            {" "}
                            ·{" "}
                            {lastActionByDossier.get(d.id)!.created_by
                              ? profileMap.get(lastActionByDossier.get(d.id)!.created_by!) ?? "Inconnu"
                              : "Inconnu"}
                            ,{" "}
                            {new Date(lastActionByDossier.get(d.id)!.created_at).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="font-mono text-[15px] font-bold text-ink">{formatMontant(reste)}</div>
                    <div className="flex gap-1.5">
                      {!d.operateur_id && (
                        <Button variant="secondary" onClick={() => claimDossier(d.id)}>
                          <UserPlus size={13} />
                          Me l&apos;assigner
                        </Button>
                      )}
                      <Button variant="primary" onClick={() => setActionDossier(d)}>
                        <PhoneCall size={13} />
                        Traiter
                      </Button>
                      <Button variant="ghost" onClick={() => setAbandonDossierTarget(d)}>
                        <Ban size={13} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {actionDossier && (
        <ActionLogDialog
          open={!!actionDossier}
          onOpenChange={(open) => !open && setActionDossier(null)}
          onConfirm={async (type, resultat, note, dateRappel) => {
            await addAction(actionDossier.id, type, resultat, note, dateRappel);
            await loadLastActions();
          }}
        />
      )}
      {abandonDossierTarget && (
        <AbandonDialog
          open={!!abandonDossierTarget}
          onOpenChange={(open) => !open && setAbandonDossierTarget(null)}
          clientNom={abandonDossierTarget.client_nom}
          onConfirm={(raison) => abandonDossier(abandonDossierTarget.id, raison)}
        />
      )}
    </div>
  );
}
