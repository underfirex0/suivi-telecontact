"use client";

import { useState, useEffect } from "react";
import { Upload, FileSpreadsheet, X, CheckCircle2, Loader2 } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImportDiffView } from "@/components/import-diff-view";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { parseExcelFile, type ParsedFile } from "@/lib/import-parser";
import { computeImportDiff, type ImportDiff } from "@/lib/import-diff";
import { todayISO } from "@/lib/utils";
import type { ImportBatch, Profile } from "@/lib/types";

const KIND_LABELS: Record<string, string> = {
  en_instance: "Dossiers en instance",
  reglements: "Liste des règlements",
  inconnu: "Non reconnu",
};

export default function ImportPage() {
  const { dossiers, commitImport, fetchImportBatches, profiles } = useDossiers();

  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [libelle, setLibelle] = useState(`Semaine du ${todayISO()}`);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setParsing(true);
    const files = Array.from(fileList);
    const parsed = await Promise.all(files.map((f) => parseExcelFile(f)));
    const allParsed = [...parsedFiles, ...parsed];
    setParsedFiles(allParsed);
    setDiff(computeImportDiff(allParsed, dossiers));
    setParsing(false);
  }

  function removeFile(index: number) {
    const next = parsedFiles.filter((_, i) => i !== index);
    setParsedFiles(next);
    setDiff(next.length > 0 ? computeImportDiff(next, dossiers) : null);
  }

  async function handleConfirm() {
    if (!diff) return;
    setCommitting(true);
    try {
      await commitImport(diff, libelle, parsedFiles.map((f) => f.filename));
      setDone(true);
    } catch (e) {
      alert("Erreur lors de l'import : " + (e as Error).message);
    }
    setCommitting(false);
  }

  function resetAll() {
    setParsedFiles([]);
    setDiff(null);
    setLibelle(`Semaine du ${todayISO()}`);
    setDone(false);
  }

  return (
    <>
      <Topbar title="Import" description="Injecter les fichiers hebdomadaires et suivre ce qui a changé" />
      <div className="px-8 py-6">
        <Tabs defaultValue="nouvel-import">
          <TabsList className="mb-5">
            <TabsTrigger value="nouvel-import">Nouvel import</TabsTrigger>
            <TabsTrigger value="historique">Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="nouvel-import">
            {done ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-success/30 bg-success-tint py-14 text-center">
                <CheckCircle2 size={32} className="text-success" />
                <div className="font-display text-[17px] font-semibold text-ink">Import terminé</div>
                <div className="text-[13px] text-ink-2">Les dossiers et paiements ont été enregistrés avec succès.</div>
                <Button onClick={resetAll} className="mt-2">
                  Faire un nouvel import
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-5 rounded-xl border-2 border-dashed border-border bg-surface p-8 text-center">
                  <Upload size={28} className="mx-auto mb-3 text-ink-3" />
                  <div className="mb-1 font-display text-[14.5px] font-semibold text-ink">
                    Déposer les fichiers Excel de la semaine
                  </div>
                  <div className="mb-4 text-[12.5px] text-ink-2">
                    Liste des règlements, fichiers "en instance"... le type est détecté automatiquement.
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark">
                    <Upload size={14} />
                    Choisir des fichiers
                    <input
                      type="file"
                      accept=".xls,.xlsx"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                  </label>
                </div>

                {parsing && (
                  <div className="mb-5 flex items-center justify-center gap-2 text-[13px] text-ink-2">
                    <Loader2 size={16} className="animate-spin" />
                    Analyse des fichiers...
                  </div>
                )}

                {parsedFiles.length > 0 && (
                  <div className="mb-6 flex flex-col gap-2">
                    {parsedFiles.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-2.5"
                      >
                        <FileSpreadsheet size={16} className="flex-shrink-0 text-ink-3" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] font-semibold text-ink">{f.filename}</div>
                          <div className="text-[11px] text-ink-2">
                            {KIND_LABELS[f.kind]} ·{" "}
                            {f.kind === "en_instance"
                              ? `${f.enInstanceRows.length} lignes`
                              : f.kind === "reglements"
                              ? `${f.reglementRows.length} lignes`
                              : "—"}
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(i)}
                          className="rounded-md p-1.5 text-ink-3 hover:bg-danger-tint hover:text-danger"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {diff && (
                  <>
                    <div className="mb-5 max-w-sm">
                      <Label htmlFor="libelle">Libellé de cet import</Label>
                      <Input id="libelle" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
                    </div>

                    <ImportDiffView diff={diff} />

                    <div className="mt-4 flex justify-end">
                      <Button onClick={handleConfirm} disabled={committing}>
                        {committing ? "Import en cours..." : "Confirmer et injecter"}
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="historique">
            <HistoriqueImports fetchImportBatches={fetchImportBatches} profiles={profiles} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function HistoriqueImports({
  fetchImportBatches,
  profiles,
}: {
  fetchImportBatches: () => Promise<ImportBatch[]>;
  profiles: Profile[];
}) {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name]));

  useEffect(() => {
    fetchImportBatches().then((b) => {
      setBatches(b);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-surface-2" />;

  if (batches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface py-10 text-center text-[13px] text-ink-2">
        Aucun import effectué pour l&apos;instant.
      </div>
    );
  }

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
                {b.created_by ? profileMap.get(b.created_by) ?? "Inconnu" : "Inconnu"} ·{" "}
                {b.fichiers.join(", ")}
              </div>
            </div>
            <div className="flex gap-4 text-[12px] text-ink-2">
              <span>
                <strong className="text-ink">{b.nb_nouveaux_dossiers}</strong> nouveaux
              </span>
              <span>
                <strong className="text-success">{b.nb_dossiers_soldes}</strong> soldés
              </span>
              <span>
                <strong className="text-warn">{b.nb_dossiers_partiels}</strong> partiels
              </span>
              <span className="font-mono font-semibold text-ink">
                {b.montant_total_regle.toLocaleString("fr-FR")} MAD
              </span>
            </div>
          </button>
          {expanded === b.id && (
            <div className="border-t border-border px-4 py-4">
              <ImportDiffView diff={b.detail} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
