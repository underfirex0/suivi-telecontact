"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { FacturerDialog } from "@/components/facturer-dialog";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { analyzeDossier, dateReferencement } from "@/lib/dossier-logic";
import { formatDate, formatMontant } from "@/lib/utils";
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
    deleteDossier,
    markQcOk,
    markQcCorrection,
    markFacture,
    markPaye,
    toggleJuridique,
    fetchHistorique,
  } = useDossiers();

  const dossier = dossiers.find((d) => d.id === params.id);

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

  async function handleSave() {
    setSaving(true);
    await updateDossier(dossier!.id, {
      notes: notes.trim() || null,
      operateur_id: operateurId || null,
      juridique_notes: juridiqueNotes.trim() || null,
    });
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`Supprimer définitivement le dossier de "${dossier!.client_nom}" ? Cette action est irréversible.`)) return;
    await deleteDossier(dossier!.id);
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

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <Badge color={a.color}>{a.label}</Badge>
            <span className="text-[12.5px] text-ink-2">{a.sub}</span>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-4">
            <DetailItem label="Offre" value={dossier.offre || "—"} />
            <DetailItem label="Contact client" value={dossier.contact_client || "—"} />
            <DetailItem label="Commercial" value={dossier.commercial || "—"} />
            <DetailItem label="Date BC signé" value={formatDate(dossier.date_bc)} mono />
            <DetailItem
              label="Date référencement (estimée)"
              value={formatDate(format(dateReferencement(dossier.date_bc), "yyyy-MM-dd"))}
              mono
            />
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
            {dossier.date_facture && <DetailItem label="Date facture" value={formatDate(dossier.date_facture)} mono />}
            {dossier.montant_facture != null && (
              <DetailItem label="Montant" value={formatMontant(dossier.montant_facture)} mono />
            )}
            {dossier.date_paiement && <DetailItem label="Date paiement" value={formatDate(dossier.date_paiement)} mono />}
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

          <div className="mb-6 flex flex-wrap gap-2">
            {dossier.etape === "qc" && (
              <>
                <Button variant="success" disabled={busy} onClick={() => runAction(() => markQcOk(dossier.id))}>
                  ✓ QC OK — Valider
                </Button>
                <Button variant="warn" disabled={busy} onClick={() => runAction(() => markQcCorrection(dossier.id))}>
                  ✗ QC — Demander correction
                </Button>
              </>
            )}
            {dossier.etape === "facturation" && (
              <Button onClick={() => setFacturerOpen(true)}>Marquer facturé</Button>
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
              </>
            )}
            {dossier.etape === "paye" && <Badge color="success">Dossier clôturé</Badge>}
          </div>

          <div className="mb-5 h-px bg-border" />

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
            <Button variant="danger" onClick={handleDelete}>
              <Trash2 size={14} />
              Supprimer le dossier
            </Button>
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

function DetailItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">{label}</div>
      <div className={`text-[13.5px] font-medium text-ink ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
