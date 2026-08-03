import type { Dossier } from "./types";
import type { ParsedFile } from "./import-parser";

export interface DiffNouveauDossier {
  source: "en_instance" | "reglement_seul";
  client: string;
  ville: string | null;
  commercial: string | null;
  numeroFacture: string;
  montantFacture: number;
  montantRecu: number;
  dateCreation: string | null;
  dateDebutVisibilite: string | null;
  dateFinVisibilite: string | null;
  courrielNiveau: 1 | 2 | 3 | null;
  teleacteur: string | null;
  paye: boolean;
}

export interface DiffPaiementExistant {
  dossierId: string;
  client: string;
  numeroFacture: string;
  montantAjoute: number;
  ancienRecu: number;
  montantFacture: number | null;
  nouveauTotal: number;
  soldeApres: number;
  devientPaye: boolean;
  dateReglement: string | null;
}

export interface ImportDiff {
  nouveaux: DiffNouveauDossier[];
  paiementsExistants: DiffPaiementExistant[];
  anomalies: { ligne: string; raison: string }[];
}

const TOLERANCE = 0.01;

export function computeImportDiff(files: ParsedFile[], existingDossiers: Dossier[]): ImportDiff {
  const existingByFacture = new Map<string, Dossier>();
  existingDossiers.forEach((d) => {
    if (d.numero_facture) existingByFacture.set(d.numero_facture, d);
  });

  const enInstanceByFacture = new Map<string, ParsedFile["enInstanceRows"][number]>();
  files.forEach((f) => f.enInstanceRows.forEach((r) => enInstanceByFacture.set(r.numeroFacture, r)));

  const reglementsByFacture = new Map<string, { montant: number; client: string; ville: string | null; date: string | null }>();
  files.forEach((f) =>
    f.reglementRows.forEach((r) => {
      const cur = reglementsByFacture.get(r.numeroFacture);
      if (cur) cur.montant += r.montant;
      else reglementsByFacture.set(r.numeroFacture, { montant: r.montant, client: r.client, ville: r.ville, date: r.dateReglement });
    })
  );

  const nouveaux: DiffNouveauDossier[] = [];
  const paiementsExistants: DiffPaiementExistant[] = [];
  const anomalies: { ligne: string; raison: string }[] = [];

  // 1) Nouveaux dossiers détectés via un fichier "en instance"
  for (const [facture, row] of enInstanceByFacture) {
    if (existingByFacture.has(facture)) continue;
    if (!row.client) {
      anomalies.push({ ligne: `Facture ${facture}`, raison: "Nom du client manquant, ligne ignorée." });
      continue;
    }
    nouveaux.push({
      source: "en_instance",
      client: row.client,
      ville: row.ville,
      commercial: row.commercial,
      numeroFacture: facture,
      montantFacture: row.montantFacture,
      montantRecu: row.montantRecu,
      dateCreation: row.dateCreation,
      dateDebutVisibilite: row.dateDebutVisibilite,
      dateFinVisibilite: row.dateFinVisibilite,
      courrielNiveau: row.courrielNiveau,
      teleacteur: row.teleacteur,
      paye: row.montantFacture > 0 && row.montantRecu >= row.montantFacture - TOLERANCE,
    });
  }

  // 2) Nouveaux dossiers détectés uniquement via la liste des règlements
  //    (jamais vus dans un fichier "en instance" — supposés réglés intégralement,
  //    faute d'un montant facturé connu par ailleurs — à vérifier lors de la revue).
  for (const [facture, r] of reglementsByFacture) {
    if (existingByFacture.has(facture)) continue;
    if (enInstanceByFacture.has(facture)) continue;
    nouveaux.push({
      source: "reglement_seul",
      client: r.client,
      ville: r.ville,
      commercial: null,
      numeroFacture: facture,
      montantFacture: r.montant,
      montantRecu: r.montant,
      dateCreation: r.date,
      dateDebutVisibilite: null,
      dateFinVisibilite: null,
      courrielNiveau: null,
      teleacteur: null,
      paye: true,
    });
  }

  // 3) Paiements qui s'appliquent à des dossiers déjà connus
  for (const [facture, r] of reglementsByFacture) {
    const existing = existingByFacture.get(facture);
    if (!existing) continue;
    const ancienRecu = existing.montant_recu ?? 0;
    const montantFacture = existing.montant_facture;
    const nouveauTotal = ancienRecu + r.montant;
    const soldeApres = montantFacture != null ? Math.max(0, montantFacture - nouveauTotal) : 0;
    paiementsExistants.push({
      dossierId: existing.id,
      client: existing.client_nom,
      numeroFacture: facture,
      montantAjoute: r.montant,
      ancienRecu,
      montantFacture,
      nouveauTotal,
      soldeApres,
      devientPaye: montantFacture != null && nouveauTotal >= montantFacture - TOLERANCE,
      dateReglement: r.date,
    });
  }

  // Fichiers non reconnus
  files.forEach((f) => {
    if (f.kind === "inconnu") {
      anomalies.push({ ligne: f.filename, raison: "Format de fichier non reconnu — ni 'en instance' ni 'règlements'." });
    }
  });

  return { nouveaux, paiementsExistants, anomalies };
}

export function diffKpis(diff: ImportDiff) {
  const nbNouveaux = diff.nouveaux.length;
  const nbSoldes =
    diff.nouveaux.filter((n) => n.paye).length + diff.paiementsExistants.filter((p) => p.devientPaye).length;
  const nbPartiels = diff.paiementsExistants.filter((p) => !p.devientPaye).length;
  const montantTotalRegle =
    diff.nouveaux.reduce((s, n) => s + n.montantRecu, 0) +
    diff.paiementsExistants.reduce((s, p) => s + p.montantAjoute, 0);
  return { nbNouveaux, nbSoldes, nbPartiels, montantTotalRegle };
}
