"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Archive, RotateCcw, Undo2 } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { FacturerDialog } from "@/components/facturer-dialog";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { analyzeDossier, dateReferencement } from "@/lib/dossier-logic";
import { formatMontant } from "@/lib/utils";
import { useNow } from "@/lib/use-now";
import type { HistoriqueEntry } from "@/lib/types";

export default function DossierDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    dossiers,
    profiles,
    loading,
    updateDossier,
    archiveDossier,
    restoreDossier,
    markQcOk,
    markQcCorrection,
    markFacture,
    markPaye,
    toggleJuridique,
    revertQcCorrection,
    revertValidation,
    revertFacturation,
    revertPaiement,
    fetchHistorique,
  } = useDossiers();

  const dossier = dossiers.find((d) => d.id === params.id);

  const [clientNom, setClientNom] = useState("");
  const [offre, setOffre] = useState("");
  const [contact, setContact] = useState("");
  const [commercial, setCommercial] = useState("");
  const [dateBc, setDateBc] = useState("");
  const [notes, setNotes] = useState("");
  const [juridiqueNotes, setJuridiqueNotes] = useState("");
  const [operateurId, setOperateurId] = useState("");
  const [historique, setHistorique] = useState<HistoriqueEntry[]>([]);
  const [facturerOpen, setFacturerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const now = useNow();

  useEffect(() => {
    if (dossier) {
      setClientNom(dossier.client_nom ?? "");
      setOffre(dossier.offre ?? "");
      setContact(dossier.contact_client ?? "");
      setCommercial(dossier.commercial ?? "");
      setDateBc(dossier.date_bc ?? "");
      setNotes(dossier.notes ?? "");
      setJuridiqueNotes(dossier.juridique_notes ?? "");
      setOperateurId(dossier.operateur_id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossier?.id]);

  useEffect(() => {
    if (params.id) {
      fetchHistorique(params.id).then(setHistorique);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, dossier?.updated_at]);

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, p.full_name));
    return m;
  }, [profiles]);

  if (loading) {
    return (
      <div className="px-8 py-6">
        <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-2">
        <div className="font-display text-[16px] font-semibold text-ink">Dossier introuvable</div>
        <Button variant="secondary" onClick={() => router.push("/dossiers")}>
          Retour aux dossiers
        </Button>
      </div>
    );
  }

  const a = analyzeDossier(dossier, now);
  const isArchived = !!dossier.archived_at;

  async function handleSave() {
    if (!clientNom.trim()) {
      alert("Le nom du client est requis.");
      return;
    }
    setSaving(true);
    await updateDossier(
      dossier!.id,
      {
        client_nom: clientNom.trim(),
        offre: offre.trim() || null,
        contact_client: contact.trim() || null,
        commercial: commercial.trim() || null,
        date_bc: dateBc,
        notes: notes.trim() || null,
        operateur_id: operateurId || null,
        juridique_notes: juridiqueNotes.trim() || null,
      },
      "Informations du dossier modifiées."
    );
    setSaving(false);
  }

  async function handleArchive() {
    if (
      !confirm(
        `Archiver le dossier de "${dossier!.client_nom}" ? Il disparaîtra des vues actives mais restera consultable et restaurable dans les archives.`
      )
    )
      return;
    await archiveDossier(dossier!.id);
    router.push("/dossiers");
  }

  async function runAction(fn: () => Promise<void>) {
    setBusy(true);
    await fn();
    setBusy(false);
  }

  return (
    <>
      <Topbar title={dossier.client_nom} description="Détail du dossier" />
      <div className="mx-auto max-w-3xl px-8 py-6">
        <button
          onClick={() => router.push("/dossiers")}
          className="mb-4 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={14} />
          Retour aux dossiers
        </button>

        {isArchived && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-warn/30 bg-warn-tint px-4 py-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-warn">
              <Archive size={15} />
              Ce dossier est archivé.
            </div>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => runAction(() => restoreDossier(dossier.id))}
            >
              <RotateCcw size={14} />
              Restaurer
            </Button>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <Badge color={a.color}>{a.label}</Badge>
            <span className="text-[12.5px] text-ink-2">{a.sub}</span>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-4">
            <div className="col-span-2">
              <Label htmlFor="d-client">Nom du client *</Label>
              <Input id="d-client" value={clientNom} onChange={(e) => setClientNom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="d-offre">Offre / référencement</Label>
              <Input id="d-offre" value={offre} onChange={(e) => setOffre(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="d-contact">Contact client</Label>
              <Input id="d-contact" value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="d-commercial">Commercial</Label>
              <Input id="d-commercial" value={commercial} onChange={(e) => setCommercial(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="d-datebc">Date BC signé</Label>
              <Input id="d-datebc" type="date" value={dateBc} onChange={(e) => setDateBc(e.target.value)} />
            </div>
            <div>
              <Label>Opérateur assigné</Label>
              <Select value={operateurId} onValueChange={setOperateurId}>
                <SelectTrigger>
                  <SelectValue placeholder="— Aucun —" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{dateReferencement(dossier.created_at) > now ? "Référencement prévu" : "Référencé le"}</Label>
              <div className="pt-1.5 font-mono text-[13.5px] font-medium text-ink">
                {dateReferencement(dossier.created_at).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            {dossier.montant_facture != null && (
              <div>
                <Label>Montant facturé</Label>
                <div className="pt-1.5 font-mono text-[13.5px] font-medium text-ink">
                  {formatMontant(dossier.montant_facture)}
                </div>
              </div>
            )}
          </div>

          {dossier.etape === "paiement" && (
            <div className="mb-4">
              <Label htmlFor="jnotes">Notes suivi juridique / relances</Label>
              <Textarea
                id="jnotes"
                value={juridiqueNotes}
                onChange={(e) => setJuridiqueNotes(e.target.value)}
                placeholder="ex: mise en demeure envoyée le..."
              />
            </div>
          )}

          <div className="mb-5">
            <Label htmlFor="notes">Notes générales</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Remarques..." />
          </div>

          <div className="mb-2 flex flex-wrap gap-2">
            {dossier.etape === "qc" && dossier.qc_sous_statut !== "a_corriger" && (
              <>
                <Button variant="success" disabled={busy} onClick={() => runAction(() => markQcOk(dossier.id))}>
                  ✓ QC OK — Valider
                </Button>
                <Button variant="warn" disabled={busy} onClick={() => runAction(() => markQcCorrection(dossier.id))}>
                  ✗ QC — Demander correction
                </Button>
              </>
            )}
            {dossier.etape === "qc" && dossier.qc_sous_statut === "a_corriger" && (
              <>
                <Button variant="success" disabled={busy} onClick={() => runAction(() => markQcOk(dossier.id))}>
                  ✓ QC OK — Valider
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => runAction(() => revertQcCorrection(dossier.id))}
                >
                  <Undo2 size={14} />
                  Annuler la demande de correction
                </Button>
              </>
            )}
            {dossier.etape === "facturation" && (
              <>
                <Button onClick={() => setFacturerOpen(true)}>Marquer facturé</Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => runAction(() => revertValidation(dossier.id))}
                >
                  <Undo2 size={14} />
                  Annuler la validation (retour en QC)
                </Button>
              </>
            )}
            {dossier.etape === "paiement" && (
              <>
                <Button variant="success" disabled={busy} onClick={() => runAction(() => markPaye(dossier.id))}>
                  Marquer payé
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => runAction(() => toggleJuridique(dossier.id))}
                >
                  {dossier.juridique_actif ? "Retirer du suivi juridique" : "Activer suivi juridique manuellement"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => runAction(() => revertFacturation(dossier.id))}
                >
                  <Undo2 size={14} />
                  Annuler la facturation
                </Button>
              </>
            )}
            {dossier.etape === "paye" && (
              <>
                <Badge color="success">Dossier clôturé</Badge>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => runAction(() => revertPaiement(dossier.id))}
                >
                  <Undo2 size={14} />
                  Annuler le paiement
                </Button>
              </>
            )}
          </div>

          <div className="mb-5 mt-4 h-px bg-border" />

          <div className="mb-3 font-display text-[14px] font-semibold text-ink">Historique</div>
          <div className="flex flex-col">
            {historique.length === 0 && <div className="py-2 text-[12.5px] text-ink-2">Aucun historique.</div>}
            {historique.map((h) => (
              <div key={h.id} className="flex gap-3 border-b border-border py-2.5 last:border-none">
                <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand" />
                <div>
                  <div className="text-[12.5px] text-ink">{h.texte}</div>
                  <div className="mt-0.5 text-[11px] text-ink-3">
                    {h.auteur_id ? profileMap.get(h.auteur_id) ?? "Inconnu" : "Inconnu"} ·{" "}
                    {new Date(h.created_at).toLocaleString("fr-FR")}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
            {!isArchived ? (
              <Button variant="danger" onClick={handleArchive}>
                <Archive size={14} />
                Archiver le dossier
              </Button>
            ) : (
              <div />
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>

      <FacturerDialog
        open={facturerOpen}
        onOpenChange={setFacturerOpen}
        onConfirm={(date, montant) => markFacture(dossier.id, date, montant)}
      />
    </>
  );
}
