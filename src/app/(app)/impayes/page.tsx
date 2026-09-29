"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  Loader2,
  PhoneCall,
  History,
  Ban,
  RotateCcw,
  Check,
  CalendarClock,
  MessageSquareText,
  MapPin,
  Mail,
  AlertTriangle,
  Database,
} from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Topbar } from "@/components/topbar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ImpayesDiffView } from "@/components/impayes-diff-view";
import {
  ImpayeActionDialog,
  ImpayeCloseDialog,
  ImpayeHistoryDialog,
  IMPAYE_ACTION_LABELS,
} from "@/components/impaye-dialogs";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { createClient } from "@/lib/supabase/client";
import { parseExcelFile, type ParsedFile } from "@/lib/import-parser";
import {
  computeImpayesDiff,
  impayesDiffKpis,
  type Impaye,
  type ImpayeAction,
  type ImpayeImportBatch,
} from "@/lib/impayes";
import {
  addImpayeAction,
  commitImpayesImport,
  fetchImpayeActions,
  fetchImpayeImports,
  fetchImpayes,
  fetchLastActions,
  updateImpaye,
  type ImpayeActionInput,
} from "@/lib/impayes-api";
import { SOCIETE_LABELS, SUPPORT_LABELS, editionTab, impayeTypeLabel } from "@/lib/tags";
import { STATUS_HEX } from "@/lib/status-colors";
import { cn, formatMontant, formatDate, todayISO } from "@/lib/utils";
import type { StatusColor } from "@/lib/types";

type StatutTab = "ouvert" | "solde" | "clos";
type RappelFilter = "all" | "aujourdhui" | "retard";
type SortMode = "priorite" | "montant" | "anciennete" | "rappel";

/** Le champ "Agent" du fichier mêle des personnes et des étapes de traitement. */
const AGENT_STAGES: Record<string, { label: string; color: StatusColor; border: StatusColor }> = {
  PRECTX: { label: "Pré-contentieux", color: "perte", border: "perte" },
  AVOCAT: { label: "Avocat", color: "juridique", border: "juridique" },
  FERMEE: { label: "Société fermée", color: "neutral", border: "neutral" },
};

function agentInfo(agent: string | null) {
  if (!agent) return { label: "Non affecté", color: "warning" as StatusColor, border: "warning" as StatusColor };
  return (
    AGENT_STAGES[agent.toUpperCase()] ?? { label: agent, color: "neutral" as StatusColor, border: "warning" as StatusColor }
  );
}

function ancienneteLabel(dateStr: string | null, today: string): string {
  if (!dateStr) return "—";
  const days = differenceInCalendarDays(parseISO(today), parseISO(dateStr));
  if (days < 0) return "à venir";
  if (days < 31) return `${days} j`;
  const mois = Math.floor(days / 30.4375);
  if (mois < 24) return `${mois} mois`;
  const ans = Math.floor(days / 365.25);
  const reste = Math.floor((days - ans * 365.25) / 30.4375);
  return reste > 0 ? `${ans} ans ${reste} mois` : `${ans} ans`;
}

export default function ImpayesPage() {
  const supabase = useMemo(() => createClient(), []);
  const { profiles } = useDossiers();
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p.full_name])), [profiles]);
  const today = todayISO();

  const [impayes, setImpayes] = useState<Impaye[]>([]);
  const [lastActions, setLastActions] = useState<Map<string, ImpayeAction>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [list, last] = await Promise.all([fetchImpayes(supabase), fetchLastActions(supabase)]);
      setImpayes(list);
      setLastActions(last);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as { message?: string }).message ?? "Erreur de chargement.");
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ---------------- Filtres ----------------
  const [search, setSearch] = useState("");
  const [statutTab, setStatutTab] = useState<StatutTab>("ouvert");
  const [agentFilter, setAgentFilter] = useState("all");
  const [societeFilter, setSocieteFilter] = useState("all");
  const [supportFilter, setSupportFilter] = useState("all");
  const [editionFilter, setEditionFilter] = useState("all");
  const [villeFilter, setVilleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [rappelFilter, setRappelFilter] = useState<RappelFilter>("all");
  const [jamaisTraite, setJamaisTraite] = useState(false);
  const [montantMin, setMontantMin] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("priorite");
  const [limit, setLimit] = useState(100);

  const distinct = (get: (i: Impaye) => string | null) =>
    Array.from(new Set(impayes.map(get).filter((x): x is string => !!x))).sort();
  const agents = useMemo(() => distinct((i) => i.agent), [impayes]); // eslint-disable-line react-hooks/exhaustive-deps
  const villes = useMemo(() => distinct((i) => i.ville), [impayes]); // eslint-disable-line react-hooks/exhaustive-deps
  const editionsPresentes = useMemo(
    () => Array.from(new Set(impayes.map((i) => i.edition).filter((x): x is number => x != null))).sort((a, b) => b - a),
    [impayes]
  );

  const ouverts = useMemo(() => impayes.filter((i) => i.statut === "ouvert"), [impayes]);
  const kpis = useMemo(() => {
    const resteTotal = ouverts.reduce((s, i) => s + i.reste, 0);
    const rappelAujourdhui = ouverts.filter((i) => i.date_rappel === today).length;
    const rappelRetard = ouverts.filter((i) => i.date_rappel != null && i.date_rappel < today).length;
    const plusAncien = ouverts.map((i) => i.date_impaye).filter((d): d is string => !!d).sort()[0] ?? null;
    const parAgent = new Map<string, { nb: number; reste: number }>();
    ouverts.forEach((i) => {
      const k = i.agent ?? "Non affecté";
      const cur = parAgent.get(k) ?? { nb: 0, reste: 0 };
      cur.nb += 1;
      cur.reste += i.reste;
      parAgent.set(k, cur);
    });
    return {
      resteTotal,
      rappelAujourdhui,
      rappelRetard,
      plusAncien,
      parAgent: Array.from(parAgent.entries())
        .map(([agent, v]) => ({ agent, ...v }))
        .sort((a, b) => b.reste - a.reste),
    };
  }, [ouverts, today]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const min = Number(montantMin) || 0;
    const list = impayes.filter((i) => {
      if (i.statut !== statutTab) return false;
      if (s && !(`${i.client_nom} ${i.numero_dossier} ${i.ordre ?? ""}`.toLowerCase().includes(s))) return false;
      if (agentFilter === "__none__" ? i.agent : agentFilter !== "all" && i.agent !== agentFilter) return false;
      if (societeFilter !== "all" && i.societe !== societeFilter) return false;
      if (supportFilter !== "all" && i.support !== supportFilter) return false;
      if (editionFilter === "none" ? i.edition != null : editionFilter !== "all" && String(i.edition) !== editionFilter)
        return false;
      if (villeFilter !== "all" && i.ville !== villeFilter) return false;
      if (typeFilter.size > 0 && !(i.type && typeFilter.has(i.type))) return false;
      if (rappelFilter === "aujourdhui" && i.date_rappel !== today) return false;
      if (rappelFilter === "retard" && !(i.date_rappel && i.date_rappel < today)) return false;
      if (jamaisTraite && i.derniere_action_at) return false;
      if (min && i.reste < min) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sortMode === "montant") return b.reste - a.reste;
      if (sortMode === "anciennete") return (a.date_impaye ?? "9999").localeCompare(b.date_impaye ?? "9999");
      if (sortMode === "rappel") return (a.date_rappel ?? "9999").localeCompare(b.date_rappel ?? "9999");
      // priorité : jamais traités d'abord (les plus gros montants en tête), puis les moins récemment traités
      const ta = a.derniere_action_at ? 1 : 0;
      const tb = b.derniere_action_at ? 1 : 0;
      if (ta !== tb) return ta - tb;
      if (!a.derniere_action_at) return b.reste - a.reste;
      return (a.derniere_action_at ?? "").localeCompare(b.derniere_action_at ?? "");
    });
  }, [
    impayes, statutTab, search, agentFilter, societeFilter, supportFilter, editionFilter, villeFilter,
    typeFilter, rappelFilter, jamaisTraite, montantMin, sortMode, today,
  ]);

  const hasActiveFilters =
    !!search || agentFilter !== "all" || societeFilter !== "all" || supportFilter !== "all" || editionFilter !== "all" ||
    villeFilter !== "all" || typeFilter.size > 0 || rappelFilter !== "all" || jamaisTraite || !!montantMin;

  function resetFilters() {
    setSearch("");
    setAgentFilter("all");
    setSocieteFilter("all");
    setSupportFilter("all");
    setEditionFilter("all");
    setVilleFilter("all");
    setTypeFilter(new Set());
    setRappelFilter("all");
    setJamaisTraite(false);
    setMontantMin("");
    setLimit(100);
  }

  function toggleType(t: string) {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  // ---------------- Traitement ----------------
  const [traiterTarget, setTraiterTarget] = useState<Impaye | null>(null);
  const [closeTarget, setCloseTarget] = useState<Impaye | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Impaye | null>(null);
  const [historyActions, setHistoryActions] = useState<ImpayeAction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleTraiter(input: ImpayeActionInput, nouvelAgent: string | null) {
    if (!traiterTarget) return;
    await addImpayeAction(supabase, traiterTarget, input);
    if (nouvelAgent && nouvelAgent !== traiterTarget.agent) {
      await updateImpaye(supabase, traiterTarget.id, { agent: nouvelAgent }, `Agent : ${traiterTarget.agent ?? "—"} → ${nouvelAgent}`);
    }
    await reload();
  }

  async function run(fn: () => Promise<void>) {
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setActionError((e as { message?: string }).message ?? "Erreur.");
    }
  }

  async function openHistory(i: Impaye) {
    setHistoryTarget(i);
    setHistoryLoading(true);
    try {
      setHistoryActions(await fetchImpayeActions(supabase, i.id));
    } catch {
      setHistoryActions([]);
    }
    setHistoryLoading(false);
  }

  // ---------------- Import ----------------
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [parsing, setParsing] = useState(false);
  const [libelle, setLibelle] = useState(`Impayés du ${todayISO()}`);
  const [cloreAbsents, setCloreAbsents] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [importDone, setImportDone] = useState(false);

  const importDiff = useMemo(
    () => (parsedFiles.length > 0 ? computeImpayesDiff(parsedFiles, impayes) : null),
    [parsedFiles, impayes]
  );

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setParsing(true);
    const files = Array.from(fileList);
    const parsed = (await Promise.all(files.map((f) => parseExcelFile(f)))).flat();
    await reload(); // l'aperçu se compare à l'état le plus récent
    setParsedFiles((prev) => [...prev, ...parsed]);
    setParsing(false);
  }

  async function handleConfirmImport() {
    if (!importDiff) return;
    setCommitting(true);
    try {
      // Garde-fou : recalcul avec les données les plus fraîches ; si elles ont changé, on réaffiche l'aperçu.
      const fresh = await fetchImpayes(supabase);
      const freshDiff = computeImpayesDiff(parsedFiles, fresh);
      if (JSON.stringify(freshDiff) !== JSON.stringify(importDiff)) {
        setImpayes(fresh);
        alert("Les données ont changé depuis l'aperçu. Il vient d'être actualisé : vérifiez-le puis confirmez à nouveau.");
        setCommitting(false);
        return;
      }
      await commitImpayesImport(supabase, importDiff, libelle, parsedFiles.map((f) => f.filename).join(", "), cloreAbsents);
      await reload();
      setImportDone(true);
    } catch (e) {
      alert("Erreur lors de l'import : " + ((e as { message?: string }).message ?? "inconnue"));
    }
    setCommitting(false);
  }

  function resetImport() {
    setParsedFiles([]);
    setImportDone(false);
    setLibelle(`Impayés du ${todayISO()}`);
    setCloreAbsents(true);
  }

  const importKpis = importDiff ? impayesDiffKpis(importDiff) : null;

  // ---------------- Rendu ----------------
  if (loadError) {
    return (
      <>
        <Topbar title="Impayés" description="Portefeuille d'impayés — à traiter, relancer, solder" />
        <div className="px-8 py-6">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-warn/30 bg-warn-tint px-6 py-12 text-center">
            <Database size={26} className="text-warn" />
            <div className="font-display text-[16px] font-semibold text-ink">Le module Impayés n&apos;est pas encore activé</div>
            <div className="max-w-lg text-[13px] text-ink-2">
              Exécutez le fichier <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[12px]">supabase/migration-012-impayes.sql</code>{" "}
              dans Supabase (SQL Editor), puis rechargez cette page.
            </div>
            <div className="font-mono text-[11px] text-ink-3">{loadError}</div>
            <Button variant="secondary" onClick={() => { setLoading(true); reload(); }}>
              Réessayer
            </Button>
          </div>
        </div>
      </>
    );
  }

  const compteur = (s: StatutTab) => impayes.filter((i) => i.statut === s).length;

  return (
    <>
      <Topbar
        title="Impayés"
        description="Portefeuille d'impayés — à traiter, relancer, solder"
        search={search}
        onSearchChange={setSearch}
      />
      <div className="px-8 py-6">
        <Tabs defaultValue="liste">
          <TabsList className="mb-5">
            <TabsTrigger value="liste">Impayés</TabsTrigger>
            <TabsTrigger value="import">Importer un fichier</TabsTrigger>
            <TabsTrigger value="historique">Historique des imports</TabsTrigger>
          </TabsList>

          {/* ========================= LISTE ========================= */}
          <TabsContent value="liste">
            {loading ? (
              <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
            ) : impayes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface py-14 text-center">
                <Upload size={24} className="text-ink-3" />
                <div className="font-display text-[15px] font-semibold text-ink">Aucun impayé pour l&apos;instant</div>
                <div className="text-[13px] text-ink-2">Importez votre fichier « Impayés » depuis l&apos;onglet « Importer un fichier ».</div>
              </div>
            ) : (
              <>
                {/* KPIs */}
                <div className="mb-4 grid grid-cols-4 gap-3.5">
                  <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Reste dû (ouverts)</div>
                    <div className="mt-1.5 font-mono text-[19px] font-bold text-ink">{formatMontant(kpis.resteTotal)}</div>
                    <div className="mt-0.5 text-[11px] text-ink-3">{ouverts.length} impayé(s) ouvert(s)</div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Rappels aujourd&apos;hui</div>
                    <div className="mt-1.5 font-display text-[24px] font-bold text-warn">{kpis.rappelAujourdhui}</div>
                    <div className="mt-0.5 text-[11px] text-ink-3">à traiter ce jour</div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Rappels en retard</div>
                    <div className="mt-1.5 font-display text-[24px] font-bold text-danger">{kpis.rappelRetard}</div>
                    <div className="mt-0.5 text-[11px] text-ink-3">date de rappel dépassée</div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Plus ancien impayé</div>
                    <div className="mt-1.5 font-mono text-[16px] font-bold text-ink">{formatDate(kpis.plusAncien)}</div>
                    <div className="mt-0.5 text-[11px] text-ink-3">il y a {ancienneteLabel(kpis.plusAncien, today)}</div>
                  </div>
                </div>

                {/* Par agent — cliquable */}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Par agent</span>
                  {kpis.parAgent.map((a) => {
                    const info = agentInfo(a.agent === "Non affecté" ? null : a.agent);
                    const active = agentFilter === (a.agent === "Non affecté" ? "__none__" : a.agent);
                    return (
                      <button
                        key={a.agent}
                        onClick={() => setAgentFilter(active ? "all" : a.agent === "Non affecté" ? "__none__" : a.agent)}
                        title={a.agent}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors",
                          active ? "border-brand bg-brand text-white" : "border-border bg-surface hover:bg-surface-2"
                        )}
                      >
                        <span className={cn("font-semibold", active ? "text-white" : "text-ink")}>{info.label}</span>
                        <span className={cn("font-mono", active ? "text-white/80" : "text-ink-3")}>{a.nb}</span>
                        <span className={cn("font-mono font-semibold", active ? "text-white" : "text-ink-2")}>
                          {Math.round(a.reste).toLocaleString("fr-FR")}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Statut */}
                <div className="mb-3 inline-flex rounded-lg bg-surface-2 p-1">
                  {(
                    [
                      ["ouvert", "Ouverts"],
                      ["solde", "Soldés"],
                      ["clos", "Clôturés"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setStatutTab(key); setLimit(100); }}
                      className={cn(
                        "rounded-md px-4 py-1.5 text-[12.5px] font-semibold transition-colors",
                        statutTab === key ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink"
                      )}
                    >
                      {label} <span className="font-mono text-[10.5px] text-ink-3">{compteur(key)}</span>
                    </button>
                  ))}
                </div>

                {/* Chips */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {(
                    [
                      { label: "Rappel aujourd'hui", active: rappelFilter === "aujourdhui", on: () => setRappelFilter(rappelFilter === "aujourdhui" ? "all" : "aujourdhui") },
                      { label: "Rappel en retard", active: rappelFilter === "retard", on: () => setRappelFilter(rappelFilter === "retard" ? "all" : "retard") },
                      { label: `Facture (${impayeTypeLabel("F")})`, active: typeFilter.has("F"), on: () => toggleType("F") },
                      { label: `Chèque (${impayeTypeLabel("C")})`, active: typeFilter.has("C"), on: () => toggleType("C") },
                      { label: "Jamais traité", active: jamaisTraite, on: () => setJamaisTraite((v) => !v) },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.label}
                      onClick={() => { c.on(); setLimit(100); }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                        c.active ? "border-brand bg-brand text-white" : "border-border bg-surface text-ink-2 hover:bg-surface-2"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* Selects */}
                <div className="mb-5 flex flex-wrap items-center gap-2.5">
                  <Select value={agentFilter} onValueChange={setAgentFilter}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les agents</SelectItem>
                      <SelectItem value="__none__">Non affectés</SelectItem>
                      {agents.map((a) => (
                        <SelectItem key={a} value={a}>{agentInfo(a).label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={societeFilter} onValueChange={setSocieteFilter}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes sociétés</SelectItem>
                      <SelectItem value="telecontact">Telecontact</SelectItem>
                      <SelectItem value="kompass">Kompass</SelectItem>
                      <SelectItem value="autre">Autre société</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={supportFilter} onValueChange={setSupportFilter}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tout support</SelectItem>
                      <SelectItem value="internet">Internet</SelectItem>
                      <SelectItem value="papier">Papier</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={editionFilter} onValueChange={setEditionFilter}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes éditions</SelectItem>
                      <SelectItem value="none">Sans édition</SelectItem>
                      {editionsPresentes.map((n) => (
                        <SelectItem key={n} value={String(n)}>{editionTab(n)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {villes.length > 0 && (
                    <Select value={villeFilter} onValueChange={setVilleFilter}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes villes</SelectItem>
                        {villes.map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    type="number"
                    placeholder="Reste min (MAD)"
                    value={montantMin}
                    onChange={(e) => setMontantMin(e.target.value)}
                    className="w-[140px]"
                  />
                  <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="priorite">À traiter en premier</SelectItem>
                      <SelectItem value="montant">Plus gros montants</SelectItem>
                      <SelectItem value="anciennete">Plus anciens d&apos;abord</SelectItem>
                      <SelectItem value="rappel">Rappel le plus ancien</SelectItem>
                    </SelectContent>
                  </Select>
                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="flex items-center gap-1 text-[12px] font-semibold text-ink-2 hover:text-danger"
                    >
                      <X size={13} /> Réinitialiser
                    </button>
                  )}
                  <span className="ml-auto text-[12px] text-ink-2">
                    {filtered.length} impayé{filtered.length > 1 ? "s" : ""} ·{" "}
                    <span className="font-mono font-semibold text-ink">
                      {formatMontant(filtered.reduce((s, i) => s + i.reste, 0))}
                    </span>
                  </span>
                </div>

                {actionError && (
                  <div className="mb-3 rounded-lg bg-danger-tint px-3 py-2 text-[12px] text-danger">{actionError}</div>
                )}

                {filtered.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-surface py-12 text-center text-[13px] text-ink-2">
                    Aucun impayé pour ces filtres.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {filtered.slice(0, limit).map((i) => {
                      const info = agentInfo(i.agent);
                      const rappelDu = i.date_rappel != null && i.date_rappel <= today;
                      const last = lastActions.get(i.id);
                      const pctRegle = i.montant_impaye > 0 ? Math.min(100, (i.montant_recu / i.montant_impaye) * 100) : 0;
                      return (
                        <div
                          key={i.id}
                          className="rounded-xl border border-border border-l-4 bg-surface p-4 shadow-card"
                          style={{ borderLeftColor: STATUS_HEX[info.border] }}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                <span title={i.agent ?? ""}>
                                  <Badge color={info.color}>{info.label}</Badge>
                                </span>
                                {i.type && (
                                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-bold text-ink-2">
                                    {impayeTypeLabel(i.type)}
                                  </span>
                                )}
                                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-ink-2">
                                  {i.societe === "autre" ? `Autre (Ste ${i.ste_code ?? "?"})` : SOCIETE_LABELS[i.societe]} ·{" "}
                                  {i.edition != null ? editionTab(i.edition) : "sans éd."} · {SUPPORT_LABELS[i.support]}
                                </span>
                                {i.ville && (
                                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-ink-2">
                                    {i.ville}
                                  </span>
                                )}
                                {i.courrier && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-warn-tint px-2 py-0.5 text-[10.5px] font-semibold text-warn">
                                    <Mail size={10} /> {i.courrier}
                                  </span>
                                )}
                              </div>

                              <div className="text-[14px] font-semibold text-ink">{i.client_nom}</div>
                              <div className="text-[12px] text-ink-2">
                                Dossier {i.numero_dossier}
                                {i.ordre ? ` · Ordre ${i.ordre}` : ""}
                                {i.commercial ? ` · ${i.commercial}` : ""}
                              </div>

                              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
                                <span>
                                  Impayé depuis <strong className="text-ink-2">{ancienneteLabel(i.date_impaye, today)}</strong>
                                  {i.date_impaye ? ` (${formatDate(i.date_impaye)})` : ""}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <PhoneCall size={11} /> {i.nbre_appel} appel{i.nbre_appel > 1 ? "s" : ""}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <MapPin size={11} /> {i.nbre_visite} visite{i.nbre_visite > 1 ? "s" : ""}
                                </span>
                                {i.date_rappel && (
                                  <span className={cn("inline-flex items-center gap-1", rappelDu && "font-semibold text-warn")}>
                                    <CalendarClock size={11} /> Rappel {rappelDu ? "dû" : "prévu"} le {formatDate(i.date_rappel)}
                                  </span>
                                )}
                                {i.date_prochaine_visite && <span>Prochaine visite : {formatDate(i.date_prochaine_visite)}</span>}
                              </div>

                              {i.montant_recu > 0 && (
                                <div className="mt-2 flex items-center gap-1.5">
                                  <span className="text-[10px] text-ink-3">Réglé</span>
                                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                                    <div className="h-full rounded-full bg-success" style={{ width: `${pctRegle}%` }} />
                                  </div>
                                  <span className="font-mono text-[10px] text-ink-3">{Math.round(pctRegle)}%</span>
                                </div>
                              )}

                              {i.statut !== "ouvert" && i.raison_cloture && (
                                <div className="mt-2 rounded-lg bg-surface-2 px-2.5 py-2 text-[11.5px] text-ink-2">
                                  {i.statut === "solde" ? "Soldé" : "Clôturé"} — {i.raison_cloture}
                                </div>
                              )}

                              {last && (
                                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-surface-2 px-2.5 py-2 text-[11.5px] text-ink-2">
                                  <MessageSquareText size={13} className="mt-0.5 flex-shrink-0 text-ink-3" />
                                  <div>
                                    <span className="font-semibold text-ink">{IMPAYE_ACTION_LABELS[last.type]}</span>
                                    {last.resultat && <span> — {last.resultat}</span>}
                                    <span className="text-ink-3">
                                      {" "}· {last.created_by ? profileMap.get(last.created_by) ?? "Inconnu" : "Inconnu"},{" "}
                                      {new Date(last.created_at).toLocaleDateString("fr-FR")}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <div className="font-mono text-[15px] font-bold text-ink">{formatMontant(i.reste)}</div>
                              {Math.abs(i.montant_impaye - i.reste) > 0.01 && (
                                <div className="text-[10.5px] text-ink-3">sur {formatMontant(i.montant_impaye)}</div>
                              )}
                              <div className="mt-1 flex flex-wrap justify-end gap-1.5">
                                {i.statut === "ouvert" ? (
                                  <>
                                    <Button onClick={() => setTraiterTarget(i)}>
                                      <PhoneCall size={13} /> Traiter
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      title="Marquer comme soldé (payé)"
                                      onClick={() => {
                                        if (confirm(`Marquer l'impayé de « ${i.client_nom} » comme soldé ?`))
                                          run(() => updateImpaye(supabase, i.id, { statut: "solde", raison_cloture: null }, "Marqué soldé manuellement."));
                                      }}
                                    >
                                      <Check size={13} /> Soldé
                                    </Button>
                                    <Button variant="ghost" title="Clôturer sans récupération" onClick={() => setCloseTarget(i)}>
                                      <Ban size={13} />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    onClick={() => run(() => updateImpaye(supabase, i.id, { statut: "ouvert", raison_cloture: null }, "Rouvert manuellement."))}
                                  >
                                    <RotateCcw size={13} /> Rouvrir
                                  </Button>
                                )}
                                <Button variant="ghost" title="Historique" onClick={() => openHistory(i)}>
                                  <History size={13} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {filtered.length > limit && (
                      <Button variant="secondary" onClick={() => setLimit((l) => l + 100)} className="self-center">
                        Afficher plus ({filtered.length - limit} restants)
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ========================= IMPORT ========================= */}
          <TabsContent value="import">
            {importDone ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-success/30 bg-success-tint py-14 text-center">
                <CheckCircle2 size={32} className="text-success" />
                <div className="font-display text-[17px] font-semibold text-ink">Import terminé</div>
                <div className="text-[13px] text-ink-2">Les impayés ont été enregistrés. Retrouvez-les dans l&apos;onglet « Impayés ».</div>
                <Button onClick={resetImport} className="mt-2">Faire un nouvel import</Button>
              </div>
            ) : (
              <>
                <div className="mb-5 rounded-xl border-2 border-dashed border-border bg-surface p-8 text-center">
                  <Upload size={28} className="mx-auto mb-3 text-ink-3" />
                  <div className="mb-1 font-display text-[14.5px] font-semibold text-ink">Déposer le fichier « Impayés »</div>
                  <div className="mx-auto mb-4 max-w-xl text-[12.5px] text-ink-2">
                    Chaque import compare le fichier à ce qui existe : les nouveaux impayés sont créés, les montants sont mis à jour,
                    et votre traitement (appels, visites, rappels, notes) n&apos;est jamais écrasé.
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark">
                    <Upload size={14} />
                    Choisir un fichier
                    <input
                      type="file"
                      accept=".xls,.xlsx"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {parsing && (
                  <div className="mb-5 flex items-center justify-center gap-2 text-[13px] text-ink-2">
                    <Loader2 size={16} className="animate-spin" /> Analyse du fichier...
                  </div>
                )}

                {parsedFiles.length > 0 && (
                  <div className="mb-6 flex flex-col gap-2">
                    {parsedFiles.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-2.5">
                        <FileSpreadsheet size={16} className="flex-shrink-0 text-ink-3" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] font-semibold text-ink">{f.filename}</div>
                          <div className="text-[11px] text-ink-2">
                            {f.kind === "impayes" ? `Fichier d'impayés · ${f.impayeRows.length} lignes` : "Ce n'est pas un fichier d'impayés"}
                          </div>
                        </div>
                        <button
                          onClick={() => setParsedFiles((prev) => prev.filter((_, j) => j !== idx))}
                          className="rounded-md p-1.5 text-ink-3 hover:bg-danger-tint hover:text-danger"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {importDiff && importKpis && (
                  <>
                    <div className="mb-5 max-w-sm">
                      <Label htmlFor="imp-libelle">Libellé de cet import</Label>
                      <Input id="imp-libelle" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
                    </div>

                    <ImpayesDiffView diff={importDiff} />

                    {importDiff.absents.length > 0 && (
                      <label className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-warn/40 bg-warn-tint px-4 py-3">
                        <input
                          type="checkbox"
                          checked={cloreAbsents}
                          onChange={(e) => setCloreAbsents(e.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-[#0E7C7B]"
                        />
                        <div className="text-[12.5px] text-ink">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <AlertTriangle size={13} className="text-warn" />
                            Marquer comme soldés les {importDiff.absents.length} impayés absents de ce fichier
                            ({formatMontant(importKpis.montantAbsents)})
                          </div>
                          <div className="mt-0.5 text-ink-2">
                            Ce fichier est un instantané complet : un impayé qui n&apos;y figure plus est réglé. <strong>Décochez
                            si ce fichier est un extrait partiel</strong> — vous pourrez toujours rouvrir un impayé ensuite.
                          </div>
                        </div>
                      </label>
                    )}

                    <div className="mt-4 flex justify-end">
                      <Button
                        onClick={handleConfirmImport}
                        disabled={
                          committing ||
                          (importDiff.nouveaux.length === 0 &&
                            importDiff.misesAJour.length === 0 &&
                            !(cloreAbsents && importDiff.absents.length > 0))
                        }
                      >
                        {committing ? "Import en cours..." : "Confirmer et importer"}
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </TabsContent>

          {/* ========================= HISTORIQUE ========================= */}
          <TabsContent value="historique">
            <HistoriqueImpayes supabase={supabase} profileMap={profileMap} refreshKey={importDone} />
          </TabsContent>
        </Tabs>
      </div>

      <ImpayeActionDialog
        impaye={traiterTarget}
        agents={agents}
        onOpenChange={(open) => !open && setTraiterTarget(null)}
        onConfirm={handleTraiter}
      />
      <ImpayeCloseDialog
        impaye={closeTarget}
        onOpenChange={(open) => !open && setCloseTarget(null)}
        onConfirm={async (raison) => {
          if (!closeTarget) return;
          await run(() => updateImpaye(supabase, closeTarget.id, { statut: "clos", raison_cloture: raison }, `Clôturé : ${raison}`));
        }}
      />
      <ImpayeHistoryDialog
        impaye={historyTarget}
        actions={historyActions}
        loading={historyLoading}
        profileName={(id) => (id ? profileMap.get(id) ?? "Inconnu" : "Inconnu")}
        onOpenChange={(open) => !open && setHistoryTarget(null)}
      />
    </>
  );
}

function HistoriqueImpayes({
  supabase,
  profileMap,
  refreshKey,
}: {
  supabase: ReturnType<typeof createClient>;
  profileMap: Map<string, string>;
  refreshKey: boolean;
}) {
  const [batches, setBatches] = useState<ImpayeImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchImpayeImports(supabase)
      .then(setBatches)
      .catch(() => setBatches([]))
      .finally(() => setLoading(false));
  }, [supabase, refreshKey]);

  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-surface-2" />;
  if (batches.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface py-10 text-center text-[13px] text-ink-2">
        Aucun import d&apos;impayés effectué pour l&apos;instant.
      </div>
    );

  return (
    <div className="flex flex-col gap-2.5">
      {batches.map((b) => (
        <div key={b.id} className="rounded-xl border border-border bg-surface shadow-card">
          <button
            onClick={() => setExpanded(expanded === b.id ? null : b.id)}
            className="flex w-full items-center gap-4 px-4 py-3.5 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold text-ink">{b.libelle}</div>
              <div className="text-[11.5px] text-ink-2">
                {new Date(b.created_at).toLocaleString("fr-FR")} ·{" "}
                {b.created_by ? profileMap.get(b.created_by) ?? "Inconnu" : "Inconnu"} · {b.fichier}
              </div>
            </div>
            <div className="flex gap-4 text-[12px] text-ink-2">
              <span><strong className="text-ink">{b.nb_nouveaux}</strong> nouveaux</span>
              <span><strong className="text-brand">{b.nb_mises_a_jour}</strong> mis à jour</span>
              <span><strong className="text-success">{b.nb_soldes}</strong> soldés</span>
            </div>
          </button>
          {expanded === b.id && (
            <div className="border-t border-border px-4 py-4">
              <ImpayesDiffView diff={b.detail} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
