"use client";

import { useState } from "react";
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
import { todayISO } from "@/lib/utils";

export function AjouterPaiementDialog({
  open,
  onOpenChange,
  onConfirm,
  reste,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (montant: number, date: string, note: string) => Promise<void>;
  reste: number | null;
}) {
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMontant("");
    setDate(todayISO());
    setNote("");
    setError(null);
  }

  async function handleConfirm() {
    const val = Number(montant);
    if (!montant || isNaN(val) || val <= 0) {
      setError("Merci de saisir un montant valide.");
      return;
    }
    if (!date) {
      setError("La date est requise.");
      return;
    }
    setSaving(true);
    await onConfirm(val, date, note.trim());
    setSaving(false);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un paiement</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogBody>
          {reste != null && (
            <div className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
              Reste dû actuellement : <span className="font-mono font-semibold text-ink">{reste.toLocaleString("fr-FR")} MAD</span>
            </div>
          )}
          <div className="mb-4">
            <Label htmlFor="p-montant">Montant reçu (MAD)</Label>
            <Input
              id="p-montant"
              type="number"
              step="0.01"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="ex: 2000.00"
            />
          </div>
          <div className="mb-4">
            <Label htmlFor="p-date">Date du paiement</Label>
            <Input id="p-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p-note">Note (optionnel)</Label>
            <Input
              id="p-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ex: chèque 2/4, virement..."
            />
          </div>
          {error && <p className="mt-3 text-[12.5px] font-medium text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer le paiement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
