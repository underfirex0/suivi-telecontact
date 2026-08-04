import * as XLSX from "xlsx";
import { format } from "date-fns";

export type FileKind = "en_instance" | "reglements" | "inconnu";

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
}

export interface ReglementRow {
  client: string;
  ville: string | null;
  numeroFacture: string;
  montant: number;
  dateReglement: string | null;
}

export interface ParsedFile {
  filename: string;
  kind: FileKind;
  enInstanceRows: EnInstanceRow[];
  reglementRows: ReglementRow[];
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
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = Number(val.replace(",", "."));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function toStr(val: unknown): string {
  if (val == null) return "";
  return String(val).trim();
}

function courrielToNiveau(val: unknown): 1 | 2 | 3 | null {
  const s = toStr(val);
  if (!s) return null;
  if (s.includes("1")) return 1;
  if (s.includes("2")) return 2;
  if (s.includes("3")) return 3;
  return null;
}

function sheetToObjects(ws: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

export async function parseExcelFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const rows = sheetToObjects(ws);

  if (rows.length === 0) {
    return { filename: file.name, kind: "inconnu", enInstanceRows: [], reglementRows: [] };
  }

  const headers = new Set(Object.keys(rows[0]));

  // --- Fichier "en instance" (même format que les exports Encaissement) ---
  if (headers.has("Raison") && headers.has("TTC") && headers.has("Facture")) {
    const enInstanceRows: EnInstanceRow[] = rows
      .filter((r) => toStr(r["Raison"])) // ignore la ligne de totaux / lignes vides en pied de fichier
      .map((r) => ({
        client: toStr(r["Raison"]),
        ville: toStr(r["Ville"]) || null,
        commercial: toStr(r["Commercial Affecté"]) || null,
        numeroFacture: r["Facture"] != null ? String(Math.trunc(toNumber(r["Facture"]))) : "",
        montantFacture: toNumber(r["TTC"]),
        montantRecu: toNumber(r["Rég.Reçu"]),
        dateCreation: excelDateToIso(r["Date création"]),
        dateDebutVisibilite: excelDateToIso(r["Date mise en ligne"]),
        dateFinVisibilite: excelDateToIso(r["Date fin ligne"]),
        courrielNiveau: courrielToNiveau(r["Couriel"]),
        teleacteur: toStr(r["Teleacteur"]) || null,
        observation: toStr(r["Observation"]) || null,
      }))
      .filter((r) => r.numeroFacture);
    return { filename: file.name, kind: "en_instance", enInstanceRows, reglementRows: [] };
  }

  // --- Fichier "liste des règlements" ---
  if (headers.has("RSOC") && headers.has("NFACT") && headers.has("DEBIT")) {
    const reglementRows: ReglementRow[] = rows
      .filter((r) => toStr(r["RSOC"]) && r["NFACT"] != null)
      .map((r) => ({
        client: toStr(r["RSOC"]),
        ville: toStr(r["VILLE"]) || null,
        numeroFacture: String(Math.trunc(toNumber(r["NFACT"]))),
        montant: toNumber(r["DEBIT"]),
        dateReglement: excelDateToIso(r["DREG"]),
      }))
      .filter((r) => r.numeroFacture);
    return { filename: file.name, kind: "reglements", enInstanceRows: [], reglementRows: reglementRows };
  }

  return { filename: file.name, kind: "inconnu", enInstanceRows: [], reglementRows: [] };
}
