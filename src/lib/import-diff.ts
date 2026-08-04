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
  observation: string | null;
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
  source: "reglement" | "ecart_en_instance";
}

export interface DiffChampModifie {
  champ: string;
  ancien: string;
  nouveau: string;
}

export interface DiffMiseAJour {
  dossierId: string;
  client: string;
  numeroFacture: string;
  champs: DiffChampModifie[];
}

export interface ImportDiff {
  nouveaux: DiffNouveauDossier[];
  paiementsExistants: DiffPaiementExistant[];
  misesAJour: DiffMiseAJour[];
  anomalies: { ligne: string; raison: string }[];
}

const TOLERANCE = 0.01;
const COURRIEL_LABELS: Record<1 | 2 | 3, string> = { 1: "Courriel 1", 2: "Courriel 2", 3: "Courriel 3" };

export function computeImportDiff(files: ParsedFile[], existingDossiers: Dossier[]): ImportDiff {
  const existingByFacture = new Map<string, Dossier>();
  existingDossiers.forEach((d) => {
    if (d.numero_facture) existingByFacture.set(d.numero_facture, d);
  });

  const enInstanceByFacture = new Map<string, ParsedFile["enInstanceRows"][number]>();
  files.forEach((f) => f.enInstanceRows.forEach((r) => enInstanceByFacture.set(r.numeroFacture, r)));

  const reglementsByFacture = new Map<
    string,
    { montant: number; client: string; ville: string | null; date: string | null }
  >();
  files.forEach((f) =>
    f.reglementRows.forEach((r) => {
      const cur = reglementsByFacture.get(r.numeroFacture);
      if (cur) cur.montant += r.montant;
      else reglementsByFacture.set(r.numeroFacture, { montant: r.montant, client: r.client, ville: r.ville, date: r.dateReglement });
    })
  );

  const nouveaux: DiffNouveauDossier[] = [];
  const paiementsExistants: DiffPaiementExistant[] = [];
  const misesAJour: DiffMiseAJour[] = [];
  const anomalies: { ligne: string; raison: string }[] = [];

  // 1) Nouveaux dossiers détectés via un fichier "en instance"
  //    OU champs mis à jour (courriel, ville, commercial, observation) pour un dossier déjà connu
  for (const [facture, row] of enInstanceByFacture) {
    const existing = existingByFacture.get(facture);

    if (!existing) {
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
        observation: row.observation,
        paye: row.montantFacture > 0 && row.montantRecu >= row.montantFacture - TOLERANCE,
      });
      continue;
    }

    // --- Dossier déjà connu : détecter tout ce qui a changé, pas seulement l'argent ---
    const champs: DiffChampModifie[] = [];

    if (row.courrielNiveau != null && row.courrielNiveau !== existing.courriel_niveau) {
      champs.push({
        champ: "Niveau de courriel",
        ancien: existing.courriel_niveau ? COURRIEL_LABELS[existing.courriel_niveau] : "Aucun",
        nouveau: COURRIEL_LABELS[row.courrielNiveau],
      });
    }
    if (row.ville && row.ville !== existing.ville) {
      champs.push({ champ: "Ville", ancien: existing.ville ?? "—", nouveau: row.ville });
    }
    if (row.commercial && row.commercial !== existing.commercial) {
      champs.push({ champ: "Commercial", ancien: existing.commercial ?? "—", nouveau: row.commercial });
    }
    if (row.observation && !(existing.notes ?? "").includes(row.observation)) {
      champs.push({ champ: "Nouvelle observation", ancien: "—", nouveau: row.observation });
    }
    if (row.montantFacture > 0 && existing.montant_facture != null && Math.abs(row.montantFacture - existing.montant_facture) > TOLERANCE) {
      anomalies.push({
        ligne: `${existing.client_nom} (facture ${facture})`,
        raison: `Écart de montant facturé : ${existing.montant_facture} MAD enregistré vs ${row.montantFacture} MAD dans le fichier — à vérifier manuellement, non modifié automatiquement.`,
      });
    }

    if (champs.length > 0) {
      misesAJour.push({ dossierId: existing.id, client: existing.client_nom, numeroFacture: facture, champs });
    }

    // Paiement révélé par un écart de Rég.Reçu dans le fichier "en instance", uniquement si
    // aucune ligne de règlement ne couvre déjà cette facture cette semaine (pour ne pas compter deux fois).
    const ancienRecu = existing.montant_recu ?? 0;
    if (row.montantRecu > ancienRecu + TOLERANCE && !reglementsByFacture.has(facture)) {
      const montantFacture = existing.montant_facture;
      const nouveauTotal = row.montantRecu;
      const soldeApres = montantFacture != null ? Math.max(0, montantFacture - nouveauTotal) : 0;
      paiementsExistants.push({
        dossierId: existing.id,
        client: existing.client_nom,
        numeroFacture: facture,
        montantAjoute: row.montantRecu - ancienRecu,
        ancienRecu,
        montantFacture,
        nouveauTotal,
        soldeApres,
        devientPaye: montantFacture != null && nouveauTotal >= montantFacture - TOLERANCE,
        dateReglement: row.dateCreation,
        source: "ecart_en_instance",
      });
    }
  }

  // 2) Nouveaux dossiers détectés uniquement via la liste des règlements
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
      observation: null,
      paye: true,
    });
  }

  // 3) Paiements (fichier règlements) sur des dossiers déjà connus
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
      source: "reglement",
    });
  }

  files.forEach((f) => {
    if (f.kind === "inconnu") {
      anomalies.push({ ligne: f.filename, raison: "Format de fichier non reconnu — ni 'en instance' ni 'règlements'." });
    }
  });

  return { nouveaux, paiementsExistants, misesAJour, anomalies };
}

export function diffKpis(diff: ImportDiff) {
  const nbNouveaux = diff.nouveaux.length;
  const nbSoldes =
    diff.nouveaux.filter((n) => n.paye).length + diff.paiementsExistants.filter((p) => p.devientPaye).length;
  const nbPartiels = diff.paiementsExistants.filter((p) => !p.devientPaye).length;
  const nbMisesAJour = diff.misesAJour.length;
  const montantTotalRegle =
    diff.nouveaux.reduce((s, n) => s + n.montantRecu, 0) +
    diff.paiementsExistants.reduce((s, p) => s + p.montantAjoute, 0);
  return { nbNouveaux, nbSoldes, nbPartiels, nbMisesAJour, montantTotalRegle };
}
