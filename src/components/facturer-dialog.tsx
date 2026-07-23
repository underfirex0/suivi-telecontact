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

export function FacturerDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (date: string, montant: number | null) => Promise<void>;
}) {
  const [date, setDate] = useState(todayISO());
  const [montant, setMontant] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!date) {
      setError("La date de facture est requise.");
      return;
    }
    setSaving(true);
    await onConfirm(date, montant ? Number(montant) : null);
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marquer comme facturé</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogBody>
          <div className="mb-4">
            <Label htmlFor="fact-date">Date de la facture</Label>
            <Input id="fact-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fact-montant">Montant (MAD)</Label>
            <Input
              id="fact-montant"
              type="number"
              step="0.01"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="ex: 3500.00"
            />
          </div>
          {error && <p className="mt-3 text-[12.5px] font-medium text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Enregistrement..." : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
