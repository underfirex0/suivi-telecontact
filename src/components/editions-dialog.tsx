"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, BookOpen } from "lucide-react";
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { useScope } from "@/components/providers/scope-provider";
import { SOCIETES, SOCIETE_COLORS, editionTab } from "@/lib/tags";
import { cn } from "@/lib/utils";
import type { EditionStatut, Societe } from "@/lib/types";

interface Draft {
  statut: EditionStatut;
  date: string;
}

export function EditionsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { editions, saveEdition, dossiers } = useDossiers();
  const { scope } = useScope();

  const [societe, setSociete] = useState<Societe>("telecontact");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [newNumero, setNewNumero] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSociete(scope.societe === "all" ? "telecontact" : scope.societe);
  }, [open, scope.societe]);

  // On repart de zéro quand on ouvre ou qu'on change de société (les brouillons ne fuient pas d'une société à l'autre)
  useEffect(() => {
    setDrafts({});
    setError(null);
  }, [open, societe]);

  const list = useMemo(() => {
    const map = new Map<number, { numero: number; statut: EditionStatut; date: string | null }>();
    editions
      .filter((e) => e.societe === societe)
      .forEach((e) => map.set(e.numero, { numero: e.numero, statut: e.statut, date: e.date_sortie_annuaire }));
    // Une édition présente dans des dossiers mais absente de la table apparaît quand même
    dossiers
      .filter((d) => d.societe === societe && d.edition != null)
      .forEach((d) => {
        if (!map.has(d.edition as number)) map.set(d.edition as number, { numero: d.edition as number, statut: "en_cours", date: null });
      });
    return Array.from(map.values()).sort((a, b) => b.numero - a.numero);
  }, [editions, dossiers, societe]);

  const nbDossiers = (numero: number) =>
    dossiers.filter((d) => d.societe === societe && d.edition === numero && !d.archived_at).length;

  async function save(numero: number, draft: Draft) {
    setSaving(numero);
    setError(null);
    try {
      await saveEdition(societe, numero, {
        statut: draft.statut,
        date_sortie_annuaire: draft.date || null,
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[numero];
        return next;
      });
    } catch (e) {
      setError((e as Error).message ?? "Erreur lors de l'enregistrement.");
    }
    setSaving(null);
  }

  async function addEdition() {
    const n = Number(newNumero);
    if (!Number.isInteger(n) || n <= 0) {
      setError("Saisissez un numéro d'édition valide (entier positif).");
      return;
    }
    if (list.some((e) => e.numero === n)) {
      setError(`L'édition ${n} existe déjà pour cette société.`);
      return;
    }
    setError(null);
    try {
      await saveEdition(societe, n, {});
      setNewNumero("");
    } catch (e) {
      setError((e as Error).message ?? "Erreur lors de la création.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>Gérer les éditions</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogBody>
          <div className="mb-5 inline-flex rounded-lg bg-surface-2 p-1">
            {SOCIETES.map((s) => (
              <button
                key={s.key}
                onClick={() => setSociete(s.key)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-[12.5px] font-semibold transition-colors",
                  societe === s.key ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink"
                )}
              >
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </button>
            ))}
          </div>

          <div className="mb-4 flex items-start gap-2 rounded-lg bg-[#EEF0FB] px-3.5 py-3 text-[12px] text-[#3B4CB8]">
            <BookOpen size={14} className="mt-0.5 flex-shrink-0" />
            <div>
              <strong>Papier :</strong> la facture part quand l&apos;annuaire sort en vente. Renseignez la date de sortie de
              chaque édition — dès qu&apos;elle est atteinte, les dossiers papier validés passent en alerte « Annuaire sorti —
              à facturer ».
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {list.length === 0 && (
              <div className="rounded-lg border border-dashed border-border py-6 text-center text-[12.5px] text-ink-2">
                Aucune édition pour cette société.
              </div>
            )}
            {list.map((e) => {
              const draft: Draft = drafts[e.numero] ?? { statut: e.statut, date: e.date ?? "" };
              const dirty = draft.statut !== e.statut || draft.date !== (e.date ?? "");
              return (
                <div key={e.numero} className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3">
                  <div className="w-24">
                    <div className="font-display text-[15px] font-semibold text-ink">{editionTab(e.numero)}</div>
                    <div className="text-[11px] text-ink-3">{nbDossiers(e.numero)} dossier(s)</div>
                  </div>
                  <div className="w-36">
                    <Label>Statut</Label>
                    <Select
                      value={draft.statut}
                      onValueChange={(v) => setDrafts((p) => ({ ...p, [e.numero]: { ...draft, statut: v as EditionStatut } }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en_cours">En cours</SelectItem>
                        <SelectItem value="terminee">Terminée</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-44">
                    <Label>Sortie de l&apos;annuaire (papier)</Label>
                    <Input
                      type="date"
                      value={draft.date}
                      onChange={(ev) => setDrafts((p) => ({ ...p, [e.numero]: { ...draft, date: ev.target.value } }))}
                    />
                  </div>
                  <div className="ml-auto flex items-end self-end">
                    {dirty ? (
                      <Button onClick={() => save(e.numero, draft)} disabled={saving === e.numero}>
                        {saving === e.numero ? "..." : "Enregistrer"}
                      </Button>
                    ) : (
                      <span className="flex items-center gap-1 pb-2 text-[11.5px] text-success">
                        <CheckCircle2 size={13} /> À jour
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-end gap-2 border-t border-border pt-4">
            <div className="w-40">
              <Label htmlFor="new-edition">Ajouter une édition</Label>
              <Input
                id="new-edition"
                type="number"
                min={1}
                placeholder="ex : 38"
                value={newNumero}
                onChange={(ev) => setNewNumero(ev.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={addEdition}>
              Ajouter à {SOCIETES.find((s) => s.key === societe)?.label}
            </Button>
          </div>

          {error && <div className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-[12px] text-danger">{error}</div>}
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
