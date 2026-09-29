"use client";

import { useState, useEffect, useMemo } from "react";
import { Upload, FileSpreadsheet, X, CheckCircle2, Loader2 } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImportDiffView } from "@/components/import-diff-view";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { parseExcelFile, type ParsedFile } from "@/lib/import-parser";
import { computeImportDiff } from "@/lib/import-diff";
import { SOCIETE_LABELS, SUPPORT_LABELS, editionTab } from "@/lib/tags";
import { todayISO } from "@/lib/utils";
import type { ImportBatch, Paiement, Profile } from "@/lib/types";

const KIND_LABELS: Record<string, string> = {
  en_instance: "Dossiers (débiteurs / en instance)",
  reglements: "Liste des règlements",
  impayes: "Fichier d'impayés — à importer depuis la page Impayés",
  inconnu: "Non reconnu",
};

/** Résumé des étiquettes lues DANS un fichier (société · édition · support) — pour vérifier avant d'importer. */
function fileTags(f: ParsedFile): string {
  const tags = new Set<string>();
  if (f.kind === "en_instance") {
    f.enInstanceRows.forEach((r) => {
      const soc = r.societe ? SOCIETE_LABELS[r.societe] : "Société ?";
      tags.add(`${soc} · ${r.edition != null ? editionTab(r.edition) : "sans édition"} · ${SUPPORT_LABELS[r.support]}`);
    });
  } else if (f.kind === "reglements") {
    f.reglementRows.forEach((r) => {
      tags.add(`${r.edition != null ? editionTab(r.edition) : "sans édition"}${r.support ? " · " + SUPPORT_LABELS[r.support] : ""}`);
    });
  }
  return Array.from(tags).join("  |  ");
}

function fileRowCount(f: ParsedFile): number {
  return f.kind === "en_instance"
    ? f.enInstanceRows.length
    : f.kind === "reglements"
    ? f.reglementRows.length
    : f.kind === "impayes"
    ? f.impayeRows.length
    : 0;
}

export default function ImportPage() {
  const { dossiers, commitImport, fetchImportBatches, fetchAllPaiements, profiles } = useDossiers();

  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  // Paiements déjà enregistrés : l'import ne compte jamais deux fois le même règlement.
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [libelle, setLibelle] = useState(`Semaine du ${todayISO()}`);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchAllPaiements().then(setPaiements);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // L'aperçu est toujours calculé à partir de l'état réel : fichiers + dossiers + paiements existants.
  const diff = useMemo(
    () => (parsedFiles.length > 0 ? computeImportDiff(parsedFiles, dossiers, paiements) : null),
    [parsedFiles, dossiers, paiements]
  );

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setParsing(true);
    const files = Array.from(fileList);
    const [parsedPerFile, freshPaiements] = await Promise.all([
      Promise.all(files.map((f) => parseExcelFile(f))),
      fetchAllPaiements(),
    ]);
    setPaiements(freshPaiements);
    setParsedFiles((prev) => [...prev, ...parsedPerFile.flat()]);
    setParsing(false);
  }

  function removeFile(index: number) {
    setParsedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleConfirm() {
    if (!diff) return;
    setCommitting(true);
    try {
      // Dernier garde-fou : on recalcule avec les paiements les plus récents. Si quelqu'un d'autre a importé
      // entre-temps, l'aperçu change — on l'affiche à nouveau plutôt que d'enregistrer deux fois.
      const fresh = await fetchAllPaiements();
      const freshDiff = computeImportDiff(parsedFiles, dossiers, fresh);
      if (JSON.stringify(freshDiff) !== JSON.stringify(diff)) {
        setPaiements(fresh);
        alert(
          "Les données ont changé depuis l'aperçu (un autre import a peut-être eu lieu). L'aperçu vient d'être actualisé : vérifiez-le puis confirmez à nouveau."
        );
        setCommitting(false);
        return;
      }
      await commitImport(diff, libelle, parsedFiles.map((f) => f.filename));
      setPaiements(await fetchAllPaiements());
      setDone(true);
    } catch (e) {
      alert("Erreur lors de l'import : " + (e as Error).message);
    }
    setCommitting(false);
  }

  function resetAll() {
    setParsedFiles([]);
    setLibelle(`Semaine du ${todayISO()}`);
    setDone(false);
    fetchAllPaiements().then(setPaiements);
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
                    Débiteurs (papier / internet, Telecontact / Kompass), en instance, règlements... le type, la société,
                    l&apos;édition et le support sont lus dans les fichiers.
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark">
                    <Upload size={14} />
                    Choisir des fichiers
                    <input
                      type="file"
                      accept=".xls,.xlsx"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleFiles(e.target.files);
                        e.target.value = ""; // permet de redéposer le même fichier après l'avoir retiré
                      }}
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
                            {KIND_LABELS[f.kind]} · {fileRowCount(f)} lignes
                          </div>
                          {fileTags(f) && (
                            <div className="mt-0.5 text-[11px] font-semibold text-brand">{fileTags(f)}</div>
                          )}
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
