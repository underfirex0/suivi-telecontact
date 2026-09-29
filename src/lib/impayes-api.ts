import { format } from "date-fns";
import type { createClient } from "@/lib/supabase/client";
import type { ImpayeRow } from "@/lib/import-parser";
import {
  TOLERANCE,
  impayesDiffKpis,
  type Impaye,
  type ImpayeAction,
  type ImpayeActionType,
  type ImpayeImportBatch,
  type ImpayeStatut,
  type ImpayesDiff,
} from "@/lib/impayes";

type Sb = ReturnType<typeof createClient>;

async function currentUserId(sb: Sb): Promise<string | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user?.id ?? null;
}

export async function fetchImpayes(sb: Sb): Promise<Impaye[]> {
  const { data, error } = await sb.from("impayes").select("*").order("created_at", { ascending: false }).limit(5000);
  if (error) throw error;
  return (data as Impaye[]) ?? [];
}

export async function fetchImpayeActions(sb: Sb, impayeId: string): Promise<ImpayeAction[]> {
  const { data, error } = await sb
    .from("impaye_actions")
    .select("*")
    .eq("impaye_id", impayeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ImpayeAction[]) ?? [];
}

/** Dernière action HUMAINE de chaque impayé (les lignes "systeme" sont ignorées). */
export async function fetchLastActions(sb: Sb): Promise<Map<string, ImpayeAction>> {
  const { data, error } = await sb
    .from("impaye_actions")
    .select("*")
    .neq("type", "systeme")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  const map = new Map<string, ImpayeAction>();
  ((data as ImpayeAction[]) ?? []).forEach((a) => {
    if (!map.has(a.impaye_id)) map.set(a.impaye_id, a); // déjà triées, la première est la plus récente
  });
  return map;
}

export async function fetchImpayeImports(sb: Sb): Promise<ImpayeImportBatch[]> {
  const { data, error } = await sb.from("impaye_imports").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ImpayeImportBatch[]) ?? [];
}

function toInsert(r: ImpayeRow, userId: string | null) {
  return {
    numero_dossier: r.numeroDossier,
    agent: r.agent,
    ste_code: r.steCode,
    societe: r.societe,
    sup_code: r.supCode,
    support: r.support,
    edition: r.edition,
    ordre: r.ordre,
    code_firme: r.codeFirme,
    client_nom: r.client,
    ville: r.ville,
    commercial: r.commercial,
    type: r.type,
    montant_impaye: r.montantImpaye,
    montant_recu: r.montantRecu,
    reste: r.reste,
    date_impaye: r.dateImpaye,
    date_rappel: r.dateRappel,
    nbre_appel: r.nbreAppel,
    nbre_visite: r.nbreVisite,
    date_prochaine_visite: r.dateProchaineVisite,
    courrier: r.courrier,
    statut: (r.reste <= TOLERANCE ? "solde" : "ouvert") as ImpayeStatut,
    created_by: userId,
  };
}

/**
 * Applique un import d'impayés : crée les nouveaux, met à jour l'argent des existants,
 * et (au choix) marque comme soldés ceux qui ont disparu du fichier.
 * Le traitement (agent, appels, visites, rappel, notes) n'est jamais touché.
 */
export async function commitImpayesImport(
  sb: Sb,
  diff: ImpayesDiff,
  libelle: string,
  fichier: string,
  cloreAbsents: boolean
): Promise<void> {
  const userId = await currentUserId(sb);
  const systemActions: { impaye_id: string; type: ImpayeActionType; resultat: string; created_by: string | null }[] = [];

  // 1) Nouveaux impayés (upsert "ignorer les doublons" : sûr même si quelqu'un vient d'importer)
  if (diff.nouveaux.length > 0) {
    const { data, error } = await sb
      .from("impayes")
      .upsert(diff.nouveaux.map((r) => toInsert(r, userId)), { onConflict: "numero_dossier", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    (data ?? []).forEach((row: { id: string }) =>
      systemActions.push({
        impaye_id: row.id,
        type: "systeme",
        resultat: `Importé depuis « ${libelle} ».`,
        created_by: userId,
      })
    );
  }

  // 2) Mises à jour financières
  const CLES_AUTORISEES = new Set([
    "montant_impaye",
    "montant_recu",
    "reste",
    "client_nom",
    "ville",
    "type",
    "date_impaye",
    "ordre",
    "code_firme",
    "commercial",
    "edition",
    "statut",
  ]);
  for (const maj of diff.misesAJour) {
    const patch: Record<string, unknown> = {};
    for (const c of maj.champs) if (CLES_AUTORISEES.has(c.cle)) patch[c.cle] = c.valeur;
    if (patch.statut === "ouvert") patch.raison_cloture = null;
    if (Object.keys(patch).length === 0) continue;
    const { error } = await sb.from("impayes").update(patch).eq("id", maj.impayeId);
    if (error) throw error;
    systemActions.push({
      impaye_id: maj.impayeId,
      type: "systeme",
      resultat: `Import « ${libelle} » — ${maj.champs.map((c) => `${c.champ} : ${c.ancien} → ${c.nouveau}`).join(" · ")}`,
      created_by: userId,
    });
  }

  // 3) Absents du fichier → soldés (si demandé)
  if (cloreAbsents) {
    for (const a of diff.absents) {
      const { error } = await sb
        .from("impayes")
        .update({ statut: "solde", raison_cloture: `Absent du fichier « ${libelle} » — considéré comme réglé.` })
        .eq("id", a.impayeId)
        .eq("statut", "ouvert");
      if (error) throw error;
      systemActions.push({
        impaye_id: a.impayeId,
        type: "systeme",
        resultat: `Ne figure plus dans le fichier « ${libelle} » — marqué soldé.`,
        created_by: userId,
      });
    }
  }

  if (systemActions.length > 0) {
    const { error } = await sb.from("impaye_actions").insert(systemActions);
    if (error) console.warn("Journal système non enregistré :", error.message);
  }

  // 4) Trace permanente de l'import
  const k = impayesDiffKpis(diff);
  await sb.from("impaye_imports").insert({
    libelle,
    fichier,
    nb_nouveaux: k.nbNouveaux,
    nb_mises_a_jour: k.nbMisesAJour,
    nb_soldes: k.nbSoldesParFichier + (cloreAbsents ? k.nbAbsents : 0),
    montant_reste_total: k.montantNouveaux,
    detail: diff,
    created_by: userId,
  });
}

export interface ImpayeActionInput {
  type: ImpayeActionType;
  resultat: string;
  note: string;
  dateRappel: string | null;
  dateProchaineVisite: string | null;
}

/** Enregistre une action de traitement et met à jour les compteurs / dates de l'impayé. */
export async function addImpayeAction(sb: Sb, impaye: Impaye, input: ImpayeActionInput): Promise<void> {
  const userId = await currentUserId(sb);
  const { error } = await sb.from("impaye_actions").insert({
    impaye_id: impaye.id,
    type: input.type,
    resultat: input.resultat || null,
    note: input.note || null,
    date_rappel: input.dateRappel,
    created_by: userId,
  });
  if (error) throw error;

  const patch: Record<string, unknown> = { derniere_action_at: new Date().toISOString() };
  if (input.dateRappel) patch.date_rappel = input.dateRappel;
  if (input.type === "appel") patch.nbre_appel = impaye.nbre_appel + 1;
  if (input.type === "visite") {
    patch.nbre_visite = impaye.nbre_visite + 1;
    if (input.dateProchaineVisite) patch.date_prochaine_visite = input.dateProchaineVisite;
  }
  if (input.type === "courrier") patch.courrier = `CR : ${format(new Date(), "dd/MM/yyyy")}`;
  const { error: upErr } = await sb.from("impayes").update(patch).eq("id", impaye.id);
  if (upErr) throw upErr;
}

export async function updateImpaye(sb: Sb, id: string, patch: Partial<Impaye>, journal?: string): Promise<void> {
  const { error } = await sb.from("impayes").update(patch).eq("id", id);
  if (error) throw error;
  if (journal) {
    const userId = await currentUserId(sb);
    await sb.from("impaye_actions").insert({ impaye_id: id, type: "systeme", resultat: journal, created_by: userId });
  }
}
