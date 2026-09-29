"use client";

import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { formatMontant } from "@/lib/utils";
import type { Impaye, ImpayeAction, ImpayeActionType } from "@/lib/impayes";
import type { ImpayeActionInput } from "@/lib/impayes-api";

export const IMPAYE_ACTION_LABELS: Record<ImpayeActionType, string> = {
  appel: "Appel",
  visite: "Visite",
  courrier: "Courrier recommandé",
  promesse: "Promesse de paiement",
  autre: "Autre",
  systeme: "Système",
};

const TYPES_SAISISSABLES: ImpayeActionType[] = ["appel", "visite", "courrier", "promesse", "autre"];
const GARDER = "__garder__";

/** "Traiter" : enregistre un appel / une visite / un courrier... et met à jour compteurs et dates. */
export function ImpayeActionDialog({
  impaye,
  agents,
  onOpenChange,
  onConfirm,
}: {
  impaye: Impaye | null;
  agents: string[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: ImpayeActionInput, nouvelAgent: string | null) => Promise<void>;
}) {
  const [type, setType] = useState<ImpayeActionType>("appel");
  const [resultat, setResultat] = useState("");
  const [note, setNote] = useState("");
  const [dateRappel, setDateRappel] = useState("");
  const [dateVisite, setDateVisite] = useState("");
  const [agent, setAgent] = useState(GARDER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (impaye) {
      setType("appel");
      setResultat("");
      setNote("");
      setDateRappel("");
      setDateVisite("");
      setAgent(GARDER);
      setError(null);
    }
  }, [impaye?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!impaye) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(
        {
          type,
          resultat: resultat.trim(),
          note: note.trim(),
          dateRappel: dateRappel || null,
          dateProchaineVisite: type === "visite" && dateVisite ? dateVisite : null,
        },
        agent === GARDER ? null : agent
      );
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message ?? "Erreur lors de l'enregistrement.");
    }
    setSaving(false);
  }

  return (
    <Dialog open={!!impaye} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Traiter l&apos;impayé</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogBody>
          {impaye && (
            <>
              <div className="mb-4 rounded-lg bg-surface-2 px-3.5 py-2.5">
                <div className="text-[13.5px] font-semibold text-ink">{impaye.client_nom}</div>
                <div className="text-[12px] text-ink-2">
                  Dossier {impaye.numero_dossier} · reste dû{" "}
                  <span className="font-mono font-semibold text-ink">{formatMontant(impaye.reste)}</span>
                </div>
              </div>

              <div className="mb-4">
                <Label>Type d&apos;action</Label>
                <Select value={type} onValueChange={(v) => setType(v as ImpayeActionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES_SAISISSABLES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {IMPAYE_ACTION_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-1 text-[11px] text-ink-3">
                  {type === "appel" && "Le compteur d'appels passe à " + (impaye.nbre_appel + 1) + "."}
                  {type === "visite" && "Le compteur de visites passe à " + (impaye.nbre_visite + 1) + "."}
                  {type === "courrier" && "La date du courrier recommandé est enregistrée (aujourd'hui)."}
                </div>
              </div>

              <div className="mb-4">
                <Label htmlFor="imp-resultat">Résultat</Label>
                <Input
                  id="imp-resultat"
                  value={resultat}
                  onChange={(e) => setResultat(e.target.value)}
                  placeholder="ex : injoignable, promet de payer le 15, refuse..."
                />
              </div>

              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="imp-rappel">Prochain rappel</Label>
                  <Input id="imp-rappel" type="date" value={dateRappel} onChange={(e) => setDateRappel(e.target.value)} />
                </div>
                {type === "visite" && (
                  <div>
                    <Label htmlFor="imp-visite">Prochaine visite</Label>
                    <Input id="imp-visite" type="date" value={dateVisite} onChange={(e) => setDateVisite(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="mb-4">
                <Label htmlFor="imp-note">Note (optionnel)</Label>
                <Textarea id="imp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Détails..." />
              </div>

              <div>
                <Label>Agent (optionnel : passer le dossier à quelqu&apos;un)</Label>
                <Select value={agent} onValueChange={setAgent}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GARDER}>Inchangé ({impaye.agent ?? "non affecté"})</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <div className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-[12px] text-danger">{error}</div>}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Clôture d'un impayé (irrécupérable / société fermée...) — la raison est obligatoire. */
export function ImpayeCloseDialog({
  impaye,
  onOpenChange,
  onConfirm,
}: {
  impaye: Impaye | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (raison: string) => Promise<void>;
}) {
  const [raison, setRaison] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRaison("");
  }, [impaye?.id]);

  async function submit() {
    if (!raison.trim()) return;
    setSaving(true);
    try {
      await onConfirm(raison.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!impaye} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clôturer cet impayé</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogBody>
          {impaye && (
            <>
              <p className="mb-4 text-[13px] text-ink-2">
                <strong className="text-ink">{impaye.client_nom}</strong> — {formatMontant(impaye.reste)} ne seront plus
                relancés. Vous pourrez le rouvrir à tout moment.
              </p>
              <Label htmlFor="imp-raison">Raison de la clôture *</Label>
              <Textarea
                id="imp-raison"
                value={raison}
                onChange={(e) => setRaison(e.target.value)}
                placeholder="ex : société liquidée, créance prescrite, accord amiable..."
              />
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="danger" onClick={submit} disabled={saving || !raison.trim()}>
            Clôturer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Journal complet d'un impayé : actions humaines + événements système (import, changement d'agent...). */
export function ImpayeHistoryDialog({
  impaye,
  actions,
  loading,
  profileName,
  onOpenChange,
}: {
  impaye: Impaye | null;
  actions: ImpayeAction[];
  loading: boolean;
  profileName: (id: string | null) => string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!impaye} onOpenChange={onOpenChange}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>Historique — {impaye?.client_nom}</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogBody>
          {loading ? (
            <div className="h-24 animate-pulse rounded-lg bg-surface-2" />
          ) : actions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center text-[13px] text-ink-2">
              Aucune action enregistrée pour cet impayé.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {actions.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-lg border px-3.5 py-2.5 ${
                    a.type === "systeme" ? "border-dashed border-border bg-surface-2" : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                      {a.type === "systeme" && <Bot size={12} className="text-ink-3" />}
                      {IMPAYE_ACTION_LABELS[a.type] ?? a.type}
                    </span>
                    <span className="text-[11px] text-ink-3">
                      {a.type === "systeme" ? "" : `${profileName(a.created_by)} · `}
                      {new Date(a.created_at).toLocaleString("fr-FR")}
                    </span>
                  </div>
                  {a.resultat && <div className="mt-1 text-[12px] text-ink-2">{a.resultat}</div>}
                  {a.note && <div className="mt-1 text-[11.5px] text-ink-3">{a.note}</div>}
                  {a.date_rappel && (
                    <div className="mt-1 text-[11px] text-ink-3">Rappel prévu le {a.date_rappel}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
