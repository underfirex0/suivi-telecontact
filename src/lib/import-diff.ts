import type { Dossier, Paiement, Societe, Support } from "./types";
import type { ParsedFile, EnInstanceRow } from "./import-parser";
import { SOCIETE_LABELS, SUPPORT_LABELS, isKnownSupportCode } from "./tags";

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
  // Champs ajoutés avec les éditions/sociétés — optionnels car absents des anciens imports en historique.
  societe?: Societe;
  support?: Support;
  edition?: number | null;
  ordre?: string | null;
  codeFirme?: string | null;
  preContentieux?: boolean;
  dateDernierReglement?: string | null;
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
  champ: string; // libellé lisible
  ancien: string;
  nouveau: string;
  cle?: string; // clé technique de la colonne (absente des anciens imports en historique)
  valeur?: string | number | null; // valeur à écrire
}

export interface DiffMiseAJour {
  dossierId: string;
  client: string;
  numeroFacture: string;
  champs: DiffChampModifie[];
}

export interface DiffIgnore {
  client: string;
  numeroFacture: string;
  montant: number;
  date: string | null;
  raison: string;
}

export interface ImportDiff {
  nouveaux: DiffNouveauDossier[];
  paiementsExistants: DiffPaiementExistant[];
  misesAJour: DiffMiseAJour[];
  anomalies: { ligne: string; raison: string }[];
  ignores?: DiffIgnore[];
}

const TOLERANCE = 0.01;
const COURRIEL_LABELS: Record<1 | 2 | 3, string> = { 1: "Courriel 1", 2: "Courriel 2", 3: "Courriel 3" };

interface RegGroup {
  numeroFacture: string;
  date: string | null;
  montant: number;
  client: string;
  ville: string | null;
  support: Support | null;
  edition: number | null;
}

export function computeImportDiff(
  files: ParsedFile[],
  existingDossiers: Dossier[],
  existingPaiements: Paiement[] = []
): ImportDiff {
  const nouveaux: DiffNouveauDossier[] = [];
  const paiementsExistants: DiffPaiementExistant[] = [];
  const anomalies: { ligne: string; raison: string }[] = [];
  const ignores: DiffIgnore[] = [];
  const majParDossier = new Map<string, DiffMiseAJour>();

  function addChamp(d: Dossier, champ: DiffChampModifie) {
    let maj = majParDossier.get(d.id);
    if (!maj) {
      maj = { dossierId: d.id, client: d.client_nom, numeroFacture: d.numero_facture ?? "", champs: [] };
      majParDossier.set(d.id, maj);
    }
    if (champ.cle && maj.champs.some((c) => c.cle === champ.cle)) return; // pas de doublon
    maj.champs.push(champ);
  }

  // ---- Index de l'existant ----
  const existingByFacture = new Map<string, Dossier[]>();
  existingDossiers.forEach((d) => {
    if (!d.numero_facture) return;
    const list = existingByFacture.get(d.numero_facture) ?? [];
    list.push(d);
    existingByFacture.set(d.numero_facture, list);
  });

  // Somme des paiements déjà enregistrés, par dossier et par jour (pour ne jamais compter deux fois)
  const paiementsParJour = new Map<string, number>();
  existingPaiements.forEach((p) => {
    const k = `${p.dossier_id}|${p.date_paiement}`;
    paiementsParJour.set(k, (paiementsParJour.get(k) ?? 0) + p.montant);
  });

  // ---- 1) Lecture des fichiers ----
  const enInstance = new Map<string, { row: EnInstanceRow; societe: Societe }>(); // clé société|facture
  const facturesEnInstance = new Set<string>();
  const regGroups = new Map<string, RegGroup>(); // clé facture|date
  const facturesReglement = new Set<string>();

  for (const f of files) {
    if (f.kind === "impayes") {
      anomalies.push({
        ligne: f.filename,
        raison: "Fichier d'impayés — à importer depuis la page « Impayés », pas ici. Ignoré.",
      });
      continue;
    }
    if (f.kind === "inconnu") {
      anomalies.push({ ligne: f.filename, raison: "Format de fichier non reconnu — ni 'en instance' ni 'règlements'." });
      continue;
    }

    if (f.kind === "en_instance") {
      let sansSte = 0;
      let supportInconnu = 0;
      let sansEdition = 0;
      for (const row of f.enInstanceRows) {
        let societe = row.societe;
        if (societe === null) {
          if (row.steCode == null) {
            societe = "telecontact";
            sansSte++;
          } else {
            anomalies.push({
              ligne: `${row.client} (facture ${row.numeroFacture})`,
              raison: `Code société inconnu (STE = ${row.steCode}) — ligne ignorée, à traiter manuellement.`,
            });
            continue;
          }
        }
        if (row.supCode != null && !isKnownSupportCode(row.supCode)) supportInconnu++;
        if (row.edition == null) sansEdition++;
        enInstance.set(`${societe}|${row.numeroFacture}`, { row, societe });
        facturesEnInstance.add(row.numeroFacture);
      }
      if (sansSte > 0)
        anomalies.push({ ligne: f.filename, raison: `${sansSte} ligne(s) sans code société (STE) — traitées comme Telecontact.` });
      if (supportInconnu > 0)
        anomalies.push({ ligne: f.filename, raison: `${supportInconnu} ligne(s) avec un code support inconnu — traitées comme Internet.` });
      if (sansEdition > 0)
        anomalies.push({ ligne: f.filename, raison: `${sansEdition} ligne(s) sans numéro d'édition — les nouveaux dossiers seront « Sans édition ».` });
    }

    if (f.kind === "reglements") {
      for (const r of f.reglementRows) {
        facturesReglement.add(r.numeroFacture);
        const key = `${r.numeroFacture}|${r.dateReglement ?? ""}`;
        const cur = regGroups.get(key);
        if (cur) {
          cur.montant += r.montant;
          if (cur.support == null) cur.support = r.support;
          if (cur.edition == null) cur.edition = r.edition;
        } else {
          regGroups.set(key, {
            numeroFacture: r.numeroFacture,
            date: r.dateReglement,
            montant: r.montant,
            client: r.client,
            ville: r.ville,
            support: r.support,
            edition: r.edition,
          });
        }
      }
    }
  }

  const groupsByFacture = new Map<string, RegGroup[]>();
  regGroups.forEach((g) => {
    const list = groupsByFacture.get(g.numeroFacture) ?? [];
    list.push(g);
    groupsByFacture.set(g.numeroFacture, list);
  });
  groupsByFacture.forEach((list) =>
    list.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))
  );
  const totalReglement = (facture: string) =>
    (groupsByFacture.get(facture) ?? []).reduce((s, g) => s + g.montant, 0);

  // ---- 2) Lignes "en instance" : nouveaux dossiers OU mises à jour de dossiers connus ----
  for (const { row, societe } of enInstance.values()) {
    const facture = row.numeroFacture;
    const candidates = existingByFacture.get(facture) ?? [];
    const existing = candidates.find((d) => d.societe === societe);

    if (!existing && candidates.length > 0) {
      const autre = candidates[0];
      anomalies.push({
        ligne: `${row.client} (facture ${facture})`,
        raison: `Ce n° de facture existe déjà pour « ${autre.client_nom} » (${SOCIETE_LABELS[autre.societe]}) — ligne ignorée pour ne pas mélanger deux sociétés.`,
      });
      continue;
    }

    if (!existing) {
      // Si un règlement plus récent que le fichier existe, on ne perd pas cet argent.
      const montantRecu = Math.max(row.montantRecu, totalReglement(facture));
      const groupes = groupsByFacture.get(facture) ?? [];
      const dernierReglement =
        groupes.length > 0 ? groupes[groupes.length - 1].date : null;
      nouveaux.push({
        source: "en_instance",
        client: row.client,
        ville: row.ville,
        commercial: row.commercial,
        numeroFacture: facture,
        montantFacture: row.montantFacture,
        montantRecu,
        dateCreation: row.dateCreation,
        dateDebutVisibilite: row.dateDebutVisibilite,
        dateFinVisibilite: row.dateFinVisibilite,
        courrielNiveau: row.courrielNiveau,
        teleacteur: row.teleacteur,
        observation: row.observation,
        paye: row.montantFacture > 0 && montantRecu >= row.montantFacture - TOLERANCE,
        societe,
        support: row.support,
        edition: row.edition,
        ordre: row.ordre,
        codeFirme: row.codeFirme,
        preContentieux: row.preContentieux,
        dateDernierReglement: row.dateDernierReglement ?? dernierReglement,
      });
      continue;
    }

    // --- Dossier déjà connu : détecter tout ce qui a changé, pas seulement l'argent ---
    if (row.courrielNiveau != null && row.courrielNiveau !== existing.courriel_niveau) {
      addChamp(existing, {
        champ: "Niveau de courriel",
        cle: "courriel_niveau",
        valeur: row.courrielNiveau,
        ancien: existing.courriel_niveau ? COURRIEL_LABELS[existing.courriel_niveau] : "Aucun",
        nouveau: COURRIEL_LABELS[row.courrielNiveau],
      });
    }
    if (row.ville && row.ville !== existing.ville) {
      addChamp(existing, { champ: "Ville", cle: "ville", valeur: row.ville, ancien: existing.ville ?? "—", nouveau: row.ville });
    }
    if (row.commercial && row.commercial !== existing.commercial) {
      addChamp(existing, {
        champ: "Commercial",
        cle: "commercial",
        valeur: row.commercial,
        ancien: existing.commercial ?? "—",
        nouveau: row.commercial,
      });
    }
    if (row.observation && !(existing.notes ?? "").includes(row.observation)) {
      addChamp(existing, {
        champ: "Nouvelle observation",
        cle: "notes_append",
        valeur: row.observation,
        ancien: "—",
        nouveau: row.observation,
      });
    }

    // Étiquettes : un dossier SANS édition est "non classé" → on adopte ce que dit le fichier.
    // Un dossier déjà classé n'est jamais reclassé automatiquement : l'écart est signalé.
    if (existing.edition == null) {
      if (row.edition != null) {
        addChamp(existing, { champ: "Édition", cle: "edition", valeur: row.edition, ancien: "—", nouveau: String(row.edition) });
      }
      if (row.supCode != null && row.support !== existing.support) {
        addChamp(existing, {
          champ: "Support",
          cle: "support",
          valeur: row.support,
          ancien: SUPPORT_LABELS[existing.support],
          nouveau: SUPPORT_LABELS[row.support],
        });
      }
    } else {
      if (row.edition != null && row.edition !== existing.edition) {
        anomalies.push({
          ligne: `${existing.client_nom} (facture ${facture})`,
          raison: `Édition ${row.edition} dans le fichier mais ${existing.edition} dans l'application — non modifié.`,
        });
      }
      if (row.supCode != null && row.support !== existing.support) {
        anomalies.push({
          ligne: `${existing.client_nom} (facture ${facture})`,
          raison: `Support « ${SUPPORT_LABELS[row.support]} » dans le fichier mais « ${SUPPORT_LABELS[existing.support]} » dans l'application — non modifié.`,
        });
      }
    }
    if (!existing.ordre && row.ordre) {
      addChamp(existing, { champ: "N° d'ordre", cle: "ordre", valeur: row.ordre, ancien: "—", nouveau: row.ordre });
    }
    if (!existing.code_firme && row.codeFirme) {
      addChamp(existing, { champ: "Code firme", cle: "code_firme", valeur: row.codeFirme, ancien: "—", nouveau: row.codeFirme });
    }

    if (
      row.montantFacture > 0 &&
      existing.montant_facture != null &&
      Math.abs(row.montantFacture - existing.montant_facture) > TOLERANCE
    ) {
      anomalies.push({
        ligne: `${existing.client_nom} (facture ${facture})`,
        raison: `Écart de montant facturé : ${existing.montant_facture} MAD enregistré vs ${row.montantFacture} MAD dans le fichier — à vérifier manuellement, non modifié automatiquement.`,
      });
    }

    // Paiement révélé par un écart de Rég.Reçu, uniquement si aucune ligne de règlement
    // ne couvre déjà cette facture (pour ne pas compter deux fois).
    const ancienRecu = existing.montant_recu ?? 0;
    if (row.montantRecu > ancienRecu + TOLERANCE && !facturesReglement.has(facture)) {
      const montantFacture = existing.montant_facture;
      paiementsExistants.push({
        dossierId: existing.id,
        client: existing.client_nom,
        numeroFacture: facture,
        montantAjoute: row.montantRecu - ancienRecu,
        ancienRecu,
        montantFacture,
        nouveauTotal: row.montantRecu,
        soldeApres: montantFacture != null ? Math.max(0, montantFacture - row.montantRecu) : 0,
        devientPaye: montantFacture != null && row.montantRecu >= montantFacture - TOLERANCE,
        dateReglement: row.dateDernierReglement ?? row.dateCreation,
        source: "ecart_en_instance",
      });
    }
  }

  // ---- 3) Règlements ----
  for (const [facture, groupes] of groupsByFacture) {
    const candidates = existingByFacture.get(facture) ?? [];

    // 3a) Facture jamais vue, et absente de tout fichier "en instance" → dossier créé, réglé
    if (candidates.length === 0) {
      if (facturesEnInstance.has(facture)) continue; // déjà traité en 2)
      const total = groupes.reduce((s, g) => s + g.montant, 0);
      const datees = groupes.map((g) => g.date).filter((x): x is string => !!x).sort();
      const premier = groupes[0];
      nouveaux.push({
        source: "reglement_seul",
        client: premier.client,
        ville: premier.ville,
        commercial: null,
        numeroFacture: facture,
        montantFacture: total, // hypothèse : réglé intégralement
        montantRecu: total,
        dateCreation: datees[0] ?? null,
        dateDebutVisibilite: null,
        dateFinVisibilite: null,
        courrielNiveau: null,
        teleacteur: null,
        observation: null,
        paye: true,
        // Le fichier des règlements n'indique pas la société : Telecontact par défaut (signalé dans les notes).
        societe: "telecontact",
        support: groupes.find((g) => g.support != null)?.support ?? "internet",
        edition: groupes.find((g) => g.edition != null)?.edition ?? null,
        ordre: null,
        codeFirme: null,
        preContentieux: false,
        dateDernierReglement: datees.length > 0 ? datees[datees.length - 1] : null,
      });
      continue;
    }

    // 3b) Facture ambiguë (même n° dans deux sociétés) : on ne devine pas
    if (candidates.length > 1) {
      anomalies.push({
        ligne: `${groupes[0].client} (facture ${facture})`,
        raison: "Ce n° de facture existe dans plusieurs sociétés — règlement non appliqué, à traiter manuellement.",
      });
      continue;
    }

    // 3c) Paiements sur un dossier connu — uniquement la DIFFÉRENCE avec ce qui est déjà enregistré
    const existing = candidates[0];
    let courant = existing.montant_recu ?? 0;
    for (const g of groupes) {
      const dejaEnregistre = g.date ? paiementsParJour.get(`${existing.id}|${g.date}`) ?? 0 : 0;
      const delta = g.montant - dejaEnregistre;
      if (delta <= TOLERANCE) {
        ignores.push({
          client: existing.client_nom,
          numeroFacture: facture,
          montant: g.montant,
          date: g.date,
          raison: "Déjà enregistré dans l'application",
        });
        continue;
      }
      const montantFacture = existing.montant_facture;
      const nouveauTotal = courant + delta;
      paiementsExistants.push({
        dossierId: existing.id,
        client: existing.client_nom,
        numeroFacture: facture,
        montantAjoute: delta,
        ancienRecu: courant,
        montantFacture,
        nouveauTotal,
        soldeApres: montantFacture != null ? Math.max(0, montantFacture - nouveauTotal) : 0,
        devientPaye: montantFacture != null && nouveauTotal >= montantFacture - TOLERANCE,
        dateReglement: g.date,
        source: "reglement",
      });
      courant = nouveauTotal;
    }

    // Étiquettes tirées des règlements (TEDI / NEDI) pour un dossier encore non classé
    if (existing.edition == null) {
      const ed = groupes.find((g) => g.edition != null)?.edition ?? null;
      if (ed != null) {
        addChamp(existing, { champ: "Édition", cle: "edition", valeur: ed, ancien: "—", nouveau: String(ed) });
      }
      const sup = groupes.find((g) => g.support != null)?.support ?? null;
      if (sup != null && sup !== existing.support) {
        addChamp(existing, {
          champ: "Support",
          cle: "support",
          valeur: sup,
          ancien: SUPPORT_LABELS[existing.support],
          nouveau: SUPPORT_LABELS[sup],
        });
      }
    }
  }

  // Ordre d'affichage stable : société, édition (récentes d'abord), support, client
  nouveaux.sort((a, b) => {
    const sa = a.societe ?? "telecontact";
    const sb = b.societe ?? "telecontact";
    if (sa !== sb) return sa.localeCompare(sb);
    const ea = a.edition ?? -1;
    const eb = b.edition ?? -1;
    if (ea !== eb) return eb - ea;
    const pa = a.support ?? "internet";
    const pb = b.support ?? "internet";
    if (pa !== pb) return pa.localeCompare(pb);
    return a.client.localeCompare(b.client);
  });

  return {
    nouveaux,
    paiementsExistants,
    misesAJour: Array.from(majParDossier.values()).filter((m) => m.champs.length > 0),
    anomalies,
    ignores,
  };
}

/**
 * Indicateurs de l'import. Comptés PAR DOSSIER (et non par ligne) : une facture réglée en
 * deux fois apparaît sur deux lignes mais reste un seul dossier, soldé ou partiel.
 */
export function diffKpis(diff: ImportDiff) {
  const nbNouveaux = diff.nouveaux.length;

  const dernierParDossier = new Map<string, boolean>(); // dossierId → devientPaye (dernière ligne)
  diff.paiementsExistants.forEach((p) => dernierParDossier.set(p.dossierId, p.devientPaye));
  const soldesExistants = Array.from(dernierParDossier.values()).filter(Boolean).length;
  const nbPartiels = Array.from(dernierParDossier.values()).filter((v) => !v).length;

  const nbSoldes = diff.nouveaux.filter((n) => n.paye).length + soldesExistants;
  const nbMisesAJour = diff.misesAJour.length;
  const montantTotalRegle =
    diff.nouveaux.reduce((s, n) => s + n.montantRecu, 0) +
    diff.paiementsExistants.reduce((s, p) => s + p.montantAjoute, 0);
  return { nbNouveaux, nbSoldes, nbPartiels, nbMisesAJour, montantTotalRegle };
}

/** Répartition des nouveaux dossiers par société / édition / support — pour vérifier les étiquettes avant d'importer. */
export function diffTagBreakdown(diff: ImportDiff) {
  const map = new Map<
    string,
    { societe: Societe; edition: number | null; support: Support; count: number; montant: number }
  >();
  diff.nouveaux.forEach((n) => {
    const societe = n.societe ?? "telecontact";
    const support = n.support ?? "internet";
    const edition = n.edition ?? null;
    const key = `${societe}|${edition}|${support}`;
    const cur = map.get(key) ?? { societe, edition, support, count: 0, montant: 0 };
    cur.count += 1;
    cur.montant += n.montantFacture;
    map.set(key, cur);
  });
  return Array.from(map.values()).sort((a, b) => {
    if (a.societe !== b.societe) return a.societe.localeCompare(b.societe);
    if ((a.edition ?? -1) !== (b.edition ?? -1)) return (b.edition ?? -1) - (a.edition ?? -1);
    return a.support.localeCompare(b.support);
  });
}
