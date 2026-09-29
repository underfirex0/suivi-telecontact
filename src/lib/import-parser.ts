import * as XLSX from "xlsx";
import { format } from "date-fns";
import type { Societe, Support } from "./types";
import { societeFromSte, supportFromCode, impayeSocieteFromSte } from "./tags";

export type FileKind = "en_instance" | "reglements" | "impayes" | "inconnu";

/** Ligne d'un fichier "Débiteur / en instance / Encaissement" (38 ou 33 colonnes). */
export interface EnInstanceRow {
  client: string;
  ville: string | null;
  commercial: string | null;
  numeroFacture: string;
  montantFacture: number;
  montantRecu: number;
  dateCreation: string | null; // yyyy-MM-dd
  dateDebutVisibilite: string | null;
  dateFinVisibilite: string | null;
  courrielNiveau: 1 | 2 | 3 | null;
  teleacteur: string | null;
  observation: string | null;
  // --- Étiquettes lues DANS les données (plus de devinette sur le nom de fichier) ---
  steCode: number | null; // colonne STE : 3 = Telecontact, 1 = Kompass
  societe: Societe | null; // null = colonne absente ou code inconnu
  supCode: number | null; // colonne S : 1 = papier, 2/4 = internet
  support: Support;
  edition: number | null; // colonne N° E
  ordre: string | null;
  codeFirme: string | null;
  dateDernierReglement: string | null; // colonne "Date Rég."
  preContentieux: boolean; // la colonne Teleacteur contient parfois "Pré-contentieux" (un statut, pas une personne)
}

/** Ligne d'un fichier "Liste des règlements". */
export interface ReglementRow {
  client: string;
  ville: string | null;
  numeroFacture: string;
  montant: number;
  dateReglement: string | null;
  supCode: number | null; // colonne TEDI
  support: Support | null;
  edition: number | null; // colonne NEDI
}

/** Ligne d'un fichier "Impayés". */
export interface ImpayeRow {
  numeroDossier: string; // colonne Dossier — identifiant unique de l'impayé
  agent: string | null;
  steCode: number | null;
  societe: Societe | "autre";
  supCode: number | null;
  support: Support;
  edition: number | null;
  ordre: string | null;
  codeFirme: string | null;
  client: string;
  ville: string | null;
  commercial: string | null;
  type: string | null; // F / C
  montantImpaye: number;
  montantRecu: number;
  reste: number;
  dateImpaye: string | null;
  dateRappel: string | null;
  nbreAppel: number;
  nbreVisite: number;
  dateProchaineVisite: string | null;
  courrier: string | null;
}

export interface ParsedFile {
  filename: string;
  kind: FileKind;
  enInstanceRows: EnInstanceRow[];
  reglementRows: ReglementRow[];
  impayeRows: ImpayeRow[];
}

function emptyParsed(filename: string, kind: FileKind = "inconnu"): ParsedFile {
  return { filename, kind, enInstanceRows: [], reglementRows: [], impayeRows: [] };
}

function excelDateToIso(val: unknown): string | null {
  if (val == null || val === "") return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return format(val, "yyyy-MM-dd");
  }
  return null;
}

function toNumber(val: unknown): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (typeof val === "string") {
    const n = Number(val.replace(/\s/g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

/** Entier ou null (cellule vide / texte non numérique). */
function toIntOrNull(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = typeof val === "number" ? val : Number(String(val).trim().replace(",", "."));
  return isNaN(n) ? null : Math.trunc(n);
}

function toStr(val: unknown): string {
  if (val == null) return "";
  return String(val).trim();
}

/** Identifiant numérique (facture, ordre, code firme...) rendu en texte sans ".0". */
function toIdString(val: unknown): string | null {
  const n = toIntOrNull(val);
  return n == null ? null : String(n);
}

function courrielToNiveau(val: unknown): 1 | 2 | 3 | null {
  const s = toStr(val);
  if (!s) return null;
  if (s.includes("1")) return 1;
  if (s.includes("2")) return 2;
  if (s.includes("3")) return 3;
  return null;
}

const PRE_CONTENTIEUX = /pr[ée][\s-]?contentieux/i;

function sheetToObjects(ws: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

function parseSheet(sheetName: string, filename: string, ws: XLSX.WorkSheet): ParsedFile | null {
  const rows = sheetToObjects(ws);
  if (rows.length === 0) return null;

  const headers = new Set(Object.keys(rows[0]));
  // Un onglet peut porter un nom (ex: "Règlement 36ème") différent du nom de fichier —
  // on l'inclut dans le libellé affiché pour que ce soit clair d'où vient chaque ligne.
  const label = sheetName && sheetName !== "Sheet1" && sheetName !== "A" ? `${filename} — ${sheetName}` : filename;

  // --- Fichier "Impayés" (checké en premier : colonnes très spécifiques) ---
  if (headers.has("Dossier") && headers.has("MT Impayé") && headers.has("Reste")) {
    const impayeRows: ImpayeRow[] = rows
      .filter((r) => toStr(r["Raison"]) && toIdString(r["Dossier"])) // ignore la ligne de totaux en pied de fichier
      .map((r) => {
        const steCode = toIntOrNull(r["Ste"]);
        const supCode = toIntOrNull(r["Sup"]);
        return {
          numeroDossier: toIdString(r["Dossier"]) as string,
          agent: toStr(r["Agent"]) || null,
          steCode,
          societe: impayeSocieteFromSte(steCode),
          supCode,
          support: supportFromCode(supCode),
          edition: toIntOrNull(r["Edit"]),
          ordre: toIdString(r["Ordre"]),
          codeFirme: toIdString(r["C.Firme"]),
          client: toStr(r["Raison"]),
          ville: toStr(r["Ville"]) || null,
          commercial: toStr(r["Nom"]) || null,
          type: toStr(r["Type"]) || null,
          montantImpaye: toNumber(r["MT Impayé"]),
          montantRecu: toNumber(r["Rég.Reçu"]),
          reste: toNumber(r["Reste"]),
          dateImpaye: excelDateToIso(r["Date Impayé"]),
          dateRappel: excelDateToIso(r["Date Rappel"]),
          nbreAppel: toIntOrNull(r["Nbre Appel"]) ?? 0,
          nbreVisite: toIntOrNull(r["Nbre visite"]) ?? 0,
          dateProchaineVisite: excelDateToIso(r["Date proch. visite"]),
          courrier: toStr(r["COURIER"]) || null,
        };
      });
    if (impayeRows.length === 0) return null;
    return { ...emptyParsed(label, "impayes"), impayeRows };
  }

  // --- Fichier "en instance / Débiteur / Encaissement" ---
  if (headers.has("Raison") && headers.has("TTC") && headers.has("Facture")) {
    const enInstanceRows: EnInstanceRow[] = rows
      .filter((r) => toStr(r["Raison"])) // ignore la ligne de totaux / lignes vides en pied de fichier
      .map((r) => {
        const steCode = toIntOrNull(r["STE"]);
        const supCode = toIntOrNull(r["S"]);
        const teleRaw = toStr(r["Teleacteur"]);
        const preContentieux = PRE_CONTENTIEUX.test(teleRaw);
        return {
          client: toStr(r["Raison"]),
          ville: toStr(r["Ville"]) || null,
          commercial: toStr(r["Commercial Affecté"]) || null,
          numeroFacture: toIdString(r["Facture"]) ?? "",
          montantFacture: toNumber(r["TTC"]),
          montantRecu: toNumber(r["Rég.Reçu"]),
          dateCreation: excelDateToIso(r["Date création"]),
          // Les fichiers à 33 colonnes (papier, Kompass) n'ont pas ces trois colonnes : simplement null.
          dateDebutVisibilite: excelDateToIso(r["Date mise en ligne"]),
          dateFinVisibilite: excelDateToIso(r["Date fin ligne"]),
          courrielNiveau: courrielToNiveau(r["Couriel"]),
          teleacteur: preContentieux ? null : teleRaw || null,
          observation: toStr(r["Observation"]) || null,
          steCode,
          societe: societeFromSte(steCode),
          supCode,
          support: supportFromCode(supCode),
          edition: toIntOrNull(r["N° E"]),
          ordre: toIdString(r["Ordre"]),
          codeFirme: toIdString(r["C.Firme"]),
          dateDernierReglement: excelDateToIso(r["Date Rég."]),
          preContentieux,
        };
      })
      .filter((r) => r.numeroFacture);
    if (enInstanceRows.length === 0) return null;
    return { ...emptyParsed(label, "en_instance"), enInstanceRows };
  }

  // --- Fichier "liste des règlements" ---
  if (headers.has("RSOC") && headers.has("NFACT") && headers.has("DEBIT")) {
    const reglementRows: ReglementRow[] = rows
      .filter((r) => toStr(r["RSOC"]) && r["NFACT"] != null)
      .map((r) => {
        const supCode = toIntOrNull(r["TEDI"]);
        return {
          client: toStr(r["RSOC"]),
          ville: toStr(r["VILLE"]) || null,
          numeroFacture: toIdString(r["NFACT"]) ?? "",
          montant: toNumber(r["DEBIT"]),
          dateReglement: excelDateToIso(r["DREG"]),
          supCode,
          support: supCode == null ? null : supportFromCode(supCode),
          edition: toIntOrNull(r["NEDI"]),
        };
      })
      .filter((r) => r.numeroFacture);
    if (reglementRows.length === 0) return null;
    return { ...emptyParsed(label, "reglements"), reglementRows };
  }

  return null;
}

/**
 * Parse un fichier Excel qui peut contenir plusieurs onglets (ex: un onglet par
 * édition — "Règlement 36ème", "Règlement 37ème"...). Chaque onglet reconnu
 * devient son propre ParsedFile ; les onglets vides ou non reconnus sont ignorés
 * silencieusement (un onglet vide n'est pas une anomalie, juste un onglet vide).
 */
export async function parseExcelFile(file: File): Promise<ParsedFile[]> {
  const buf = await file.arrayBuffer();
  return parseExcelBuffer(buf, file.name);
}

/** Même chose à partir d'un buffer (utilisé aussi par les tests, hors navigateur). */
export function parseExcelBuffer(buf: ArrayBuffer | Uint8Array, filename: string): ParsedFile[] {
  const wb = XLSX.read(buf, { type: buf instanceof Uint8Array ? "buffer" : "array", cellDates: true });

  const results: ParsedFile[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const parsed = parseSheet(sheetName, filename, ws);
    if (parsed) results.push(parsed);
  }

  if (results.length === 0) return [emptyParsed(filename)];
  return results;
}
