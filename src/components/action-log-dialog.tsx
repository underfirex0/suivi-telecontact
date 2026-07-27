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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { ActionType } from "@/lib/types";

const TYPE_OPTIONS: { value: ActionType; label: string }[] = [
  { value: "appel", label: "Appel" },
  { value: "email", label: "Email" },
  { value: "visite", label: "Visite" },
  { value: "promesse_paiement", label: "Promesse de paiement" },
  { value: "autre", label: "Autre" },
];

export function ActionLogDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (type: ActionType, resultat: string, note: string, dateRappel: string | null) => Promise<void>;
}) {
  const [type, setType] = useState<ActionType>("appel");
  const [resultat, setResultat] = useState("");
  const [note, setNote] = useState("");
  const [dateRappel, setDateRappel] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setType("appel");
    setResultat("");
    setNote("");
    setDateRappel("");
  }

  async function handleConfirm() {
    setSaving(true);
    await onConfirm(type, resultat.trim(), note.trim(), dateRappel || null);
    setSaving(false);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enregistrer une action</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogBody>
          <div className="mb-4">
            <Label>Type d&apos;action</Label>
            <Select value={type} onValueChange={(v) => setType(v as ActionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mb-4">
            <Label htmlFor="a-resultat">Résultat</Label>
            <Input
              id="a-resultat"
              value={resultat}
              onChange={(e) => setResultat(e.target.value)}
              placeholder="ex: injoignable, a promis de payer le 15, refuse..."
            />
          </div>
          <div className="mb-4">
            <Label htmlFor="a-rappel">Prochain rappel (optionnel)</Label>
            <Input id="a-rappel" type="date" value={dateRappel} onChange={(e) => setDateRappel(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="a-note">Note (optionnel)</Label>
            <Textarea id="a-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Détails..." />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer l'action"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
