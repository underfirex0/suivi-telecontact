"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Archive,
  RotateCcw,
  Undo2,
  Plus,
  Trash2,
  AlertTriangle,
  UserPlus,
  PhoneCall,
  Ban,
  Scale,
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { FacturerDialog } from "@/components/facturer-dialog";
import { AjouterPaiementDialog } from "@/components/ajouter-paiement-dialog";
import { ActionLogDialog } from "@/components/action-log-dialog";
import { AbandonDialog } from "@/components/abandon-dialog";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { analyzeDossier, dateReferencement, JURIDIQUE_ETAPES } from "@/lib/dossier-logic";
import { formatMontant, formatDate } from "@/lib/utils";
import { STATUS_HEX } from "@/lib/status-colors";
import { useNow } from "@/lib/use-now";
import type { HistoriqueEntry, Paiement, ActionEntry, JuridiqueEtape } from "@/lib/types";

const ACTION_TYPE_LABELS: Record<string, string> = {
  appel: "Appel",
  email: "Email",
  visite: "Visite",
  promesse_paiement: "Promesse de paiement",
  autre: "Autre",
};

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
    updateJuridiqueEtape,
    revertQcCorrection,
    revertValidation,
    revertFacturation,
    revertPaiement,
    fetchHistorique,
    fetchPaiements,
    addPaiement,
    deletePaiement,
    fetchActions,
    addAction,
    claimDossier,
    abandonDossier,
    reactivateDossier,
  } = useDossiers();

  const dossier = dossiers.find((d) => d.id === params.id);

  const [clientNom, setClientNom] = useState("");
  const [offre, setOffre] = useState("");
  const [contact, setContact] = useState("");
  const [commercial, setCommercial] = useState("");
  const [dateBc, setDateBc] = useState("");
  const [ville, setVille] = useState("");
  const [numeroFacture, setNumeroFacture] = useState("");
  const [notes, setNotes] = useState("");
  const [juridiqueNotes, setJuridiqueNotes] = useState("");
  const [avocatReferent, setAvocatReferent] = useState("");
  const [referenceTribunal, setReferenceTribunal] = useState("");
  const [montantJugement, setMontantJugement] = useState("");
  const [operateurId, setOperateurId] = useState("");
  const [historique, setHistorique] = useState<HistoriqueEntry[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [facturerOpen, setFacturerOpen] = useState(false);
  const [paiementOpen, setPaiementOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
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
      setVille(dossier.ville ?? "");
      setNumeroFacture(dossier.numero_facture ?? "");
      setNotes(dossier.notes ?? "");
      setJuridiqueNotes(dossier.juridique_notes ?? "");
      setAvocatReferent(dossier.avocat_referent ?? "");
      setReferenceTribunal(dossier.reference_tribunal ?? "");
      setMontantJugement(dossier.montant_jugement != null ? String(dossier.montant_jugement) : "");
      setOperateurId(dossier.operateur_id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossier?.id]);

  useEffect(() => {
    if (params.id) {
      fetchHistorique(params.id).then(setHistorique);
      fetchPaiements(params.id).then(setPaiements);
      fetchActions(params.id).then(setActions);
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
  const isAbandonne = !!dossier.abandonne_at;
  const reste = dossier.montant_facture != null ? dossier.montant_facture - dossier.montant_recu : null;
  const showVisibilitePanel =
    (dossier.etape === "paiement" || dossier.etape === "paye") &&
    dossier.date_debut_visibilite &&
    dossier.date_fin_visibilite;

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
        ville: ville.trim() || null,
        numero_facture: numeroFacture.trim() || null,
        notes: notes.trim() || null,
        operateur_id: operateurId || null,
        juridique_notes: juridiqueNotes.trim() || null,
        avocat_referent: avocatReferent.trim() || null,
        reference_tribunal: referenceTribunal.trim() || null,
        montant_jugement: montantJugement ? Number(montantJugement) : null,
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

  async function handleDeletePaiement(id: string) {
    if (!confirm("Supprimer ce paiement ? Le montant reçu et le statut du dossier seront recalculés.")) return;
    await deletePaiement(id, dossier!.id);
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

        {isAbandonne && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
            <div className="text-[13px] text-ink-2">
              <span className="font-semibold text-ink">Dossier abandonné</span>
              {dossier.abandonne_raison ? ` — ${dossier.abandonne_raison}` : ""}
            </div>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => runAction(() => reactivateDossier(dossier.id))}
            >
              <RotateCcw size={14} />
              Réactiver
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
              <Label htmlFor="d-ville">Ville</Label>
              <Input id="d-ville" value={ville} onChange={(e) => setVille(e.target.value)} placeholder="ex: Casablanca" />
            </div>
            <div>
              <Label htmlFor="d-facture">N° facture</Label>
              <Input id="d-facture" value={numeroFacture} onChange={(e) => setNumeroFacture(e.target.value)} />
            </div>
            <div>
              <Label>Opérateur affecté</Label>
              <div className="flex gap-2">
                <div className="flex-1">
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
                {!dossier.operateur_id && dossier.etape === "paiement" && (
                  <Button variant="secondary" onClick={() => runAction(() => claimDossier(dossier.id))}>
                    <UserPlus size={14} />
                  </Button>
                )}
              </div>
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
          </div>

          {showVisibilitePanel && (
            <div className="mb-5 rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="font-display text-[13.5px] font-semibold text-ink">Visibilité &amp; règlement</div>
                {a.desyncRisque && (
                  <Badge color="warning">
                    <AlertTriangle size={11} /> Risque de désynchronisation
                  </Badge>
                )}
              </div>

              <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-ink-2">
                <span>Temps de visibilité consommé</span>
                <span className="font-mono font-semibold text-ink">
                  {a.pctTemps != null ? Math.round(a.pctTemps) : "—"}%
                </span>
              </div>
              <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, a.pctTemps ?? 0)}%`,
                    backgroundColor: (a.pctTemps ?? 0) >= 100 ? STATUS_HEX.perte : STATUS_HEX.neutral,
                  }}
                />
              </div>

              <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-ink-2">
                <span>Montant réglé</span>
                <span className="font-mono font-semibold text-ink">
                  {a.pctPaye != null ? Math.round(a.pctPaye) : "—"}%
                </span>
              </div>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-success"
                  style={{ width: `${Math.min(100, a.pctPaye ?? 0)}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-border pt-3 text-[12px]">
                <div>
                  <div className="text-ink-2">Facturé</div>
                  <div className="font-mono font-semibold text-ink">{formatMontant(dossier.montant_facture)}</div>
                </div>
                <div>
                  <div className="text-ink-2">Reçu</div>
                  <div className="font-mono font-semibold text-success">{formatMontant(dossier.montant_recu)}</div>
                </div>
                <div>
                  <div className="text-ink-2">Reste</div>
                  <div className="font-mono font-semibold text-danger">{formatMontant(reste)}</div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-ink-3">
                Visibilité du {formatDate(dossier.date_debut_visibilite)} au {formatDate(dossier.date_fin_visibilite)}
              </div>
            </div>
          )}

          {(dossier.etape === "paiement" || dossier.etape === "paye") && (
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-display text-[13.5px] font-semibold text-ink">Paiements reçus</div>
                <Button variant="secondary" onClick={() => setPaiementOpen(true)}>
                  <Plus size={14} />
                  Ajouter un paiement
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {paiements.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border py-4 text-center text-[12px] text-ink-3">
                    Aucun paiement enregistré.
                  </div>
                )}
                {paiements.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                  >
                    <div>
                      <div className="font-mono text-[13px] font-semibold text-ink">{formatMontant(p.montant)}</div>
                      <div className="text-[11px] text-ink-2">
                        {formatDate(p.date_paiement)}
                        {p.note ? ` · ${p.note}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePaiement(p.id)}
                      className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-danger-tint hover:text-danger"
                      title="Supprimer ce paiement"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dossier.etape === "paiement" && (
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-display text-[13.5px] font-semibold text-ink">Actions de recouvrement</div>
                <Button variant="secondary" onClick={() => setActionOpen(true)}>
                  <PhoneCall size={14} />
                  Enregistrer une action
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {actions.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border py-4 text-center text-[12px] text-ink-3">
                    Aucune action enregistrée pour l&apos;instant.
                  </div>
                )}
                {actions.map((act) => (
                  <div key={act.id} className="rounded-lg border border-border px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12.5px] font-semibold text-ink">
                          {ACTION_TYPE_LABELS[act.type] ?? act.type}
                        </span>
                        {act.sous_statut && (
                          <span className="rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-bold text-warn">
                            {act.sous_statut}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-ink-3">
                        {new Date(act.created_at).toLocaleString("fr-FR")}
                      </span>
                    </div>
                    {act.resultat && <div className="mt-1 text-[12px] text-ink-2">{act.resultat}</div>}
                    {act.date_rappel && (
                      <div className="mt-1 text-[11px] font-semibold text-brand">
                        Rappel prévu le {act.date_rappel}
                      </div>
                    )}
                    {act.note && <div className="mt-1 text-[11.5px] text-ink-3">{act.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {dossier.etape === "paiement" && dossier.juridique_actif && (
            <div className="mb-5 rounded-xl border border-juridique/30 bg-juridique-tint/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-display text-[13.5px] font-semibold text-juridique">
                  <Scale size={15} />
                  Suivi juridique
                </div>
                <button
                  onClick={() => router.push("/juridique")}
                  className="text-[11.5px] font-semibold text-juridique hover:underline"
                >
                  Voir tous les dossiers juridiques →
                </button>
              </div>

              <div className="mb-3">
                <Label>Étape</Label>
                <Select
                  value={dossier.juridique_etape ?? "mise_en_demeure"}
                  onValueChange={(v) => runAction(() => updateJuridiqueEtape(dossier.id, v as JuridiqueEtape))}
                >
                  <SelectTrigger>
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
              </div>

              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="avocat">Avocat référent</Label>
                  <Input id="avocat" value={avocatReferent} onChange={(e) => setAvocatReferent(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="tribunal">Référence tribunal</Label>
                  <Input id="tribunal" value={referenceTribunal} onChange={(e) => setReferenceTribunal(e.target.value)} />
                </div>
              </div>

              <div className="mb-3">
                <Label htmlFor="mjugement">Montant jugé (si différent du montant facturé)</Label>
                <Input
                  id="mjugement"
                  type="number"
                  step="0.01"
                  value={montantJugement}
                  onChange={(e) => setMontantJugement(e.target.value)}
                  placeholder="ex: 12000.00"
                />
              </div>

              <div className="mb-3 grid grid-cols-4 gap-3 text-[11.5px] text-ink-2">
                <div>
                  <div className="text-ink-3">MED Edicom</div>
                  <div className="font-mono font-semibold text-ink">{formatDate(dossier.date_mise_en_demeure)}</div>
                </div>
                <div>
                  <div className="text-ink-3">MED Avocat</div>
                  <div className="font-mono font-semibold text-ink">
                    {formatDate(dossier.date_mise_en_demeure_avocat)}
                  </div>
                </div>
                <div>
                  <div className="text-ink-3">Assignation</div>
                  <div className="font-mono font-semibold text-ink">{formatDate(dossier.date_assignation)}</div>
                </div>
                <div>
                  <div className="text-ink-3">Jugement</div>
                  <div className="font-mono font-semibold text-ink">{formatDate(dossier.date_jugement)}</div>
                </div>
              </div>

              <Label htmlFor="jnotes">Notes juridiques</Label>
              <Textarea
                id="jnotes"
                value={juridiqueNotes}
                onChange={(e) => setJuridiqueNotes(e.target.value)}
                placeholder="ex: audience prévue le..."
              />
            </div>
          )}

          {dossier.etape === "paiement" && !dossier.juridique_actif && (
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
            {dossier.etape === "paiement" && !isAbandonne && (
              <>
                <Button variant="success" disabled={busy} onClick={() => runAction(() => markPaye(dossier.id))}>
                  Marquer soldé manuellement
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => runAction(() => toggleJuridique(dossier.id))}
                >
                  {dossier.juridique_actif ? "Retirer du suivi juridique" : "Activer suivi juridique (décision manuelle)"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => runAction(() => revertFacturation(dossier.id))}
                >
                  <Undo2 size={14} />
                  Annuler la facturation
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setAbandonOpen(true)}>
                  <Ban size={14} />
                  Abandonner ce dossier
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
      <AjouterPaiementDialog
        open={paiementOpen}
        onOpenChange={setPaiementOpen}
        reste={reste}
        onConfirm={(montant, date, note) => addPaiement(dossier.id, montant, date, note)}
      />
      <ActionLogDialog
        open={actionOpen}
        onOpenChange={setActionOpen}
        onConfirm={(type, resultat, note, dateRappel, sousStatut) =>
          addAction(dossier.id, type, resultat, note, dateRappel, sousStatut)
        }
      />
      <AbandonDialog
        open={abandonOpen}
        onOpenChange={setAbandonOpen}
        clientNom={dossier.client_nom}
        onConfirm={(raison) => abandonDossier(dossier.id, raison)}
      />
    </>
  );
}
