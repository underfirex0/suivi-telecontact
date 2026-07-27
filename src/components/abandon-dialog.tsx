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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function AbandonDialog({
  open,
  onOpenChange,
  onConfirm,
  clientNom,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (raison: string) => Promise<void>;
  clientNom: string;
}) {
  const [raison, setRaison] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!raison.trim()) {
      setError("Une raison est requise pour abandonner un dossier.");
      return;
    }
    setSaving(true);
    await onConfirm(raison.trim());
    setSaving(false);
    setRaison("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abandonner ce dossier ?</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogBody>
          <p className="mb-4 text-[13px] text-ink-2">
            <strong className="text-ink">{clientNom}</strong> sortira de la file d&apos;action active. Cette
            décision reste visible et réversible — elle n&apos;efface rien.
          </p>
          <Label htmlFor="ab-raison">Raison (obligatoire)</Label>
          <Textarea
            id="ab-raison"
            value={raison}
            onChange={(e) => setRaison(e.target.value)}
            placeholder="ex: client injoignable depuis 6 mois, montant trop faible pour justifier une action juridique..."
          />
          {error && <p className="mt-2 text-[12.5px] font-medium text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={saving}>
            {saving ? "Enregistrement..." : "Confirmer l'abandon"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
