"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, X, UserPlus, MessageSquareText, Receipt } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { analyzeDossier, JURIDIQUE_ETAPES, COURRIEL_CONFIG } from "@/lib/dossier-logic";
import { useNow } from "@/lib/use-now";
import { formatMontant, formatDate, initials, cn } from "@/lib/utils";
import { STATUS_HEX } from "@/lib/status-colors";
import type { JuridiqueEtape, ActionEntry } from "@/lib/types";
import { differenceInCalendarDays, parseISO } from "date-fns";

const TYPE_LABELS: Record<string, string> = {
  appel: "Appel",
  email: "Email",
  visite: "Visite",
  promesse_paiement: "Promesse",
  autre: "Autre",
};

type SortMode = "anciennete" | "montant" | "client";

export default function JuridiquePage() {
  const { dossiers, profiles, toggleJuridique, updateJuridiqueEtape, claimDossier, currentProfile, fetchAllActions } =
    useDossiers();
  const router = useRouter();
  const now = useNow();

  const [etapeFilter, setEtapeFilter] = useState<string>("actifs");
  const [avocatFilter, setAvocatFilter] = useState("all");
  const [villeFilter, setVilleFilter] = useState("all");
  const [operateurFilter, setOperateurFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("anciennete");
  const [lastActionByDossier, setLastActionByDossier] = useState<Map<string, ActionEntry>>(new Map());

  useEffect(() => {
    fetchAllActions().then((all) => {
      const map = new Map<string, ActionEntry>();
      for (const act of all) {
        if (!map.has(act.dossier_id)) map.set(act.dossier_id, act);
      }
      setLastActionByDossier(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p.full_name])), [profiles]);

  const enJuridique = useMemo(
    () => dossiers.filter((d) => d.juridique_actif && !d.archived_at && !d.abandonne_at),
    [dossiers]
  );

  const avocats = useMemo(() => {
    const set = new Set<string>();
    enJuridique.forEach((d) => d.avocat_referent && set.add(d.avocat_referent));
    return Array.from(set).sort();
  }, [enJuridique]);

  const villes = useMemo(() => {
    const set = new Set<string>();
    enJuridique.forEach((d) => d.ville && set.add(d.ville));
    return Array.from(set).sort();
  }, [enJuridique]);

  const filtered = useMemo(() => {
    let list = enJuridique.filter((d) => {
      const etape = d.juridique_etape ?? "en_attente";
      if (etapeFilter === "actifs" && etape === "clos") return false;
      if (etapeFilter !== "all" && etapeFilter !== "actifs" && etape !== etapeFilter) return false;
      if (avocatFilter !== "all" && d.avocat_referent !== avocatFilter) return false;
      if (villeFilter !== "all" && d.ville !== villeFilter) return false;
      if (operateurFilter === "moi" && d.operateur_id !== currentProfile?.id) return false;
      if (operateurFilter === "non_affecte" && d.operateur_id) return false;
      if (
        operateurFilter !== "all" &&
        operateurFilter !== "moi" &&
        operateurFilter !== "non_affecte" &&
        d.operateur_id !== operateurFilter
      )
        return false;
      return true;
    });

    list = list.sort((a, b) => {
      if (sortMode === "montant") {
        return (b.montant_facture ?? 0) - b.montant_recu - ((a.montant_facture ?? 0) - a.montant_recu);
      }
      if (sortMode === "client") {
        return a.client_nom.localeCompare(b.client_nom);
      }
      const joursA = a.juridique_etape_maj_at ? differenceInCalendarDays(now, parseISO(a.juridique_etape_maj_at)) : 0;
      const joursB = b.juridique_etape_maj_at ? differenceInCalendarDays(now, parseISO(b.juridique_etape_maj_at)) : 0;
      return joursB - joursA;
    });

    return list;
  }, [enJuridique, etapeFilter, avocatFilter, villeFilter, operateurFilter, sortMode, now, currentProfile]);

  const actifs = enJuridique.filter((d) => (d.juridique_etape ?? "en_attente") !== "clos");
  const montantReclame = actifs.reduce((sum, d) => sum + Math.max(0, (d.montant_facture ?? 0) - d.montant_recu), 0);
  const montantJuge = actifs.reduce((sum, d) => sum + (d.montant_jugement ?? 0), 0);
  const montantRecupere = actifs.reduce((sum, d) => sum + d.montant_recu, 0);

  const hasActiveFilters =
    etapeFilter !== "actifs" || avocatFilter !== "all" || villeFilter !== "all" || operateurFilter !== "all";

  function resetFilters() {
    setEtapeFilter("actifs");
    setAvocatFilter("all");
    setVilleFilter("all");
    setOperateurFilter("all");
  }

  return (
    <>
      <Topbar title="Suivi juridique" description="Dossiers en contentieux — étapes, échéances, montants" />
      <div className="px-8 py-6">
        <div className="mb-6 grid grid-cols-4 gap-3.5">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-2">
              Dossiers en contentieux
            </div>
            <div className="mt-1.5 font-display text-[24px] font-bold text-ink">{actifs.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-2">Montant réclamé</div>
            <div className="mt-1.5 font-mono text-[20px] font-bold text-ink">{formatMontant(montantReclame)}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-2">Montant jugé</div>
            <div className="mt-1.5 font-mono text-[20px] font-bold text-juridique">{formatMontant(montantJuge)}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-2">Déjà récupéré</div>
            <div className="mt-1.5 font-mono text-[20px] font-bold text-success">{formatMontant(montantRecupere)}</div>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2.5">
          <Select value={etapeFilter} onValueChange={setEtapeFilter}>
            <SelectTrigger className="w-[210px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="actifs">Étapes actives (hors clos)</SelectItem>
              <SelectItem value="all">Toutes les étapes</SelectItem>
              {JURIDIQUE_ETAPES.map((e) => (
                <SelectItem key={e.key} value={e.key}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={operateurFilter} onValueChange={setOperateurFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les opérateurs</SelectItem>
              {currentProfile && <SelectItem value="moi">Mes dossiers</SelectItem>}
              <SelectItem value="non_affecte">Non affectés</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {avocats.length > 0 && (
            <Select value={avocatFilter} onValueChange={setAvocatFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les avocats</SelectItem>
                {avocats.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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

          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="w-[210px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anciennete">Trier par ancienneté d&apos;étape</SelectItem>
              <SelectItem value="montant">Trier par montant</SelectItem>
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
            {filtered.length} dossier{filtered.length > 1 ? "s" : ""}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface py-12 text-center text-ink-2">
            <Scale size={22} className="opacity-40" />
            <div className="font-display text-[15px] font-semibold text-ink">Aucun dossier</div>
            <div className="text-[13px]">Aucun dossier en suivi juridique pour ces filtres.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((d) => {
              const etape = d.juridique_etape ?? "en_attente";
              const cfg = JURIDIQUE_ETAPES.find((e) => e.key === etape)!;
              const a = analyzeDossier(d, now);
              const reste = Math.max(0, (d.montant_facture ?? 0) - d.montant_recu);
              const jours = d.juridique_etape_maj_at
                ? differenceInCalendarDays(now, parseISO(d.juridique_etape_maj_at))
                : 0;
              const operateurName = d.operateur_id ? profileMap.get(d.operateur_id) : null;
              const lastAction = lastActionByDossier.get(d.id);
              const sousLigne = [d.offre, d.commercial ? `Commercial : ${d.commercial}` : null]
                .filter(Boolean)
                .join(" · ");

              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-border bg-surface p-4 shadow-card border-l-4"
                  style={{ borderLeftColor: "#5B3A8E" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => router.push(`/dossiers/${d.id}`)}>
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Badge color={cfg.color}>{cfg.label}</Badge>
                        {!operateurName && (
                          <span className="rounded-full bg-warn-tint px-2 py-0.5 text-[10.5px] font-bold text-warn">
                            Non affecté
                          </span>
                        )}
                        {d.ville && (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-ink-2">
                            {d.ville}
                          </span>
                        )}
                        {d.courriel_niveau && (
                          <Badge color={COURRIEL_CONFIG[d.courriel_niveau].color}>
                            {COURRIEL_CONFIG[d.courriel_niveau].label}
                          </Badge>
                        )}
                      </div>

                      <div className="text-[14px] font-semibold text-ink">{d.client_nom}</div>
                      {sousLigne && <div className="text-[12px] text-ink-2">{sousLigne}</div>}

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
                        <span>Dans cette étape depuis {jours}j</span>
                        {d.avocat_referent && <span>Avocat : {d.avocat_referent}</span>}
                        {d.reference_tribunal && <span>Réf. tribunal : {d.reference_tribunal}</span>}
                        {operateurName && (
                          <span className="flex items-center gap-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-tint text-[8.5px] font-bold text-brand">
                              {initials(operateurName)}
                            </span>
                            {operateurName}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-3">
                        {d.date_mise_en_demeure && <span>MED Edicom : {formatDate(d.date_mise_en_demeure)}</span>}
                        {d.date_mise_en_demeure_avocat && (
                          <span>MED Avocat : {formatDate(d.date_mise_en_demeure_avocat)}</span>
                        )}
                        {d.date_assignation && <span>Assignation : {formatDate(d.date_assignation)}</span>}
                        {d.date_jugement && <span>Jugement : {formatDate(d.date_jugement)}</span>}
                      </div>

                      {(a.pctTemps != null || a.pctPaye != null) && (
                        <div className="mt-2 flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-ink-3">Temps</span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, a.pctTemps ?? 0)}%`,
                                  backgroundColor: (a.pctTemps ?? 0) >= 100 ? STATUS_HEX.perte : STATUS_HEX.neutral,
                                }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-ink-3">
                              {a.pctTemps != null ? Math.round(a.pctTemps) : 0}%
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-ink-3">Payé</span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                              <div
                                className="h-full rounded-full bg-success"
                                style={{ width: `${Math.min(100, a.pctPaye ?? 0)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-ink-3">
                              {a.pctPaye != null ? Math.round(a.pctPaye) : 0}%
                            </span>
                          </div>
                        </div>
                      )}

                      {lastAction && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-surface-2 px-2.5 py-2 text-[11.5px] text-ink-2">
                          <MessageSquareText size={13} className="mt-0.5 flex-shrink-0 text-ink-3" />
                          <div>
                            <span className="font-semibold text-ink">
                              {TYPE_LABELS[lastAction.type] ?? lastAction.type}
                            </span>
                            {lastAction.sous_statut && (
                              <span className="ml-1 rounded-full bg-warn-tint px-1.5 py-0.5 text-[10px] font-bold text-warn">
                                {lastAction.sous_statut}
                              </span>
                            )}
                            {lastAction.resultat && <span> — {lastAction.resultat}</span>}
                            <span className="text-ink-3">
                              {" "}
                              ·{" "}
                              {lastAction.created_by ? profileMap.get(lastAction.created_by) ?? "Inconnu" : "Inconnu"},{" "}
                              {new Date(lastAction.created_at).toLocaleDateString("fr-FR")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="font-mono text-[15px] font-bold text-ink">{formatMontant(reste)}</div>
                      <div className="text-right text-[10.5px] text-ink-3">sur {formatMontant(d.montant_facture)}</div>
                      {d.montant_jugement != null && (
                        <div className="text-[10.5px] text-ink-3">jugé : {formatMontant(d.montant_jugement)}</div>
                      )}
                      {d.numero_facture && (
                        <div className="flex items-center gap-1 text-[10.5px] text-ink-3">
                          <Receipt size={10} />
                          N° {d.numero_facture}
                        </div>
                      )}
                      <Select value={etape} onValueChange={(v) => updateJuridiqueEtape(d.id, v as JuridiqueEtape)}>
                        <SelectTrigger className="w-[190px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {JURIDIQUE_ETAPES.map((e) => (
                            <SelectItem key={e.key} value={e.key}>
                              {e.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="mt-1 flex gap-1.5">
                        {!d.operateur_id && (
                          <Button variant="secondary" onClick={() => claimDossier(d.id)}>
                            <UserPlus size={13} />
                            Me l&apos;affecter
                          </Button>
                        )}
                        <Button variant="ghost" onClick={() => toggleJuridique(d.id)}>
                          Retirer
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
