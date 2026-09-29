"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useDossiers } from "@/components/providers/dossiers-provider";
import { useScope } from "@/components/providers/scope-provider";
import { SOCIETES, SUPPORTS, editionTab } from "@/lib/tags";
import { todayISO } from "@/lib/utils";
import type { Societe, Support } from "@/lib/types";

const OFFRES_SUGGESTIONS = [
  "Référencement standard",
  "Référencement premium",
  "Mise à jour fiche",
  "Référencement multi-sites",
];

export function NewDossierDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createDossier, profiles, editions } = useDossiers();
  const { scope } = useScope();
  const router = useRouter();

  // Société / support / édition : préremplis avec ce que l'on regarde en ce moment
  const [societe, setSociete] = useState<Societe>("telecontact");
  const [support, setSupport] = useState<Support>("internet");
  const [editionVal, setEditionVal] = useState("none"); // "none" = sans édition

  const [clientNom, setClientNom] = useState("");
  const [offre, setOffre] = useState("");
  const [contact, setContact] = useState("");
  const [commercial, setCommercial] = useState("");
  const [dateBc, setDateBc] = useState(todayISO());
  const [operateurId, setOperateurId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSociete(scope.societe === "all" ? "telecontact" : scope.societe);
    setSupport(scope.support === "all" ? "internet" : scope.support);
    setEditionVal(typeof scope.edition === "number" ? String(scope.edition) : "none");
  }, [open, scope]);

  const editionsDeLaSociete = editions
    .filter((e) => e.societe === societe)
    .map((e) => e.numero)
    .sort((x, y) => y - x);

  function reset() {
    setClientNom("");
    setOffre("");
    setContact("");
    setCommercial("");
    setDateBc(todayISO());
    setOperateurId("");
    setNotes("");
    setError(null);
  }

  async function handleSave() {
    if (!clientNom.trim()) {
      setError("Le nom du client est requis.");
      return;
    }
    if (!dateBc) {
      setError("La date du BC est requise.");
      return;
    }
    setSaving(true);
    const id = await createDossier({
      client_nom: clientNom.trim(),
      offre: offre.trim() || null,
      contact_client: contact.trim() || null,
      commercial: commercial.trim() || null,
      date_bc: dateBc,
      operateur_id: operateurId || null,
      notes: notes.trim() || null,
      societe,
      support,
      edition: editionVal === "none" ? null : Number(editionVal),
    });
    setSaving(false);
    if (id) {
      reset();
      onOpenChange(false);
      router.push(`/dossiers/${id}`);
    } else {
      setError("Une erreur est survenue. Réessayez.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>Nouveau dossier</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client">Nom du client *</Label>
              <Input
                id="client"
                value={clientNom}
                onChange={(e) => setClientNom(e.target.value)}
                placeholder="ex: Société Atlas SARL"
              />
            </div>
            <div className="col-span-2 grid grid-cols-3 gap-4 rounded-xl bg-surface-2 p-3.5">
              <div>
                <Label>Société</Label>
                <Select
                  value={societe}
                  onValueChange={(v) => {
                    const nouvelle = v as Societe;
                    setSociete(nouvelle);
                    const existe = editions.some((e) => e.societe === nouvelle && String(e.numero) === editionVal);
                    if (!existe) setEditionVal("none");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIETES.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Support</Label>
                <Select value={support} onValueChange={(v) => setSupport(v as Support)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTS.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Édition</Label>
                <Select value={editionVal} onValueChange={setEditionVal}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sans édition</SelectItem>
                    {editionsDeLaSociete.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {editionTab(n)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="offre">Offre / référencement</Label>
              <Input
                id="offre"
                list="offres-list"
                value={offre}
                onChange={(e) => setOffre(e.target.value)}
                placeholder="ex: Référencement standard"
              />
              <datalist id="offres-list">
                {OFFRES_SUGGESTIONS.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="contact">Contact client</Label>
              <Input
                id="contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Nom / téléphone / email"
              />
            </div>
            <div>
              <Label htmlFor="commercial">Commercial</Label>
              <Input
                id="commercial"
                value={commercial}
                onChange={(e) => setCommercial(e.target.value)}
                placeholder="Nom du commercial"
              />
            </div>
            <div>
              <Label htmlFor="dateBc">Date de réception du BC signé *</Label>
              <Input
                id="dateBc"
                type="date"
                value={dateBc}
                onChange={(e) => setDateBc(e.target.value)}
              />
            </div>
            <div>
              <Label>Opérateur affecté</Label>
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
          </div>
          <div className="mt-4">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Remarques éventuelles..."
            />
          </div>
          {error && <p className="mt-3 text-[12.5px] font-medium text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Création..." : "Créer le dossier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
