import { analyzeDossier } from "./dossier-logic";
import { formatMontant } from "./utils";
import type { Dossier, Profile } from "./types";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportDossiersToCsv(dossiers: Dossier[], profiles: Profile[]) {
  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name]));
  const now = new Date();

  const headers = [
    "Client",
    "Offre",
    "Contact client",
    "Commercial",
    "Date BC signé",
    "Statut",
    "Détail statut",
    "Date facture",
    "Montant facturé",
    "Date paiement",
    "Opérateur assigné",
    "Suivi juridique",
    "Notes",
  ];

  const rows = dossiers.map((d) => {
    const a = analyzeDossier(d, now);
    return [
      d.client_nom,
      d.offre ?? "",
      d.contact_client ?? "",
      d.commercial ?? "",
      d.date_bc,
      a.label,
      a.sub ?? "",
      d.date_facture ?? "",
      d.montant_facture != null ? formatMontant(d.montant_facture) : "",
      d.date_paiement ?? "",
      d.operateur_id ? profileMap.get(d.operateur_id) ?? "" : "",
      d.juridique_actif ? "Oui" : "Non",
      d.notes ?? "",
    ];
  });

  const csvContent =
    [headers, ...rows].map((row) => row.map((cell) => csvEscape(String(cell))).join(",")).join("\r\n");

  // BOM for Excel to correctly detect UTF-8 (accents, etc.)
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStr = now.toISOString().slice(0, 10);
  link.href = url;
  link.download = `dossiers-suivi-${dateStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
