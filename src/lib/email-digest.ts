import type { DossierStatus } from "./types";
import { STATUS_HEX } from "./status-colors";

interface AlertRow {
  clientNom: string;
  offre: string | null;
  status: DossierStatus;
  dossierId: string;
  reste: number;
}

function formatMad(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0 }) + " MAD";
}

function row(a: AlertRow, appUrl: string): string {
  const color = STATUS_HEX[a.status.color];
  const link = appUrl ? `${appUrl}/dossiers/${a.dossierId}` : "#";
  return `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #E3E5EA;border-left:4px solid ${color};background:#ffffff;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-family:Arial,sans-serif;">
              <span style="display:inline-block;background:${color}1A;color:${color};font-size:11px;font-weight:bold;padding:3px 10px;border-radius:20px;">
                ${a.status.label}
              </span>
              <div style="margin-top:8px;font-size:14px;font-weight:bold;color:#12131A;">${a.clientNom}</div>
              <div style="font-size:12.5px;color:#5B6072;margin-top:2px;">${a.offre ?? "—"}</div>
              <div style="font-size:11.5px;color:#9297A6;margin-top:6px;font-family:monospace;">${a.status.sub}</div>
            </td>
            <td style="text-align:right;vertical-align:middle;white-space:nowrap;">
              <div style="font-size:14px;font-weight:bold;color:#12131A;margin-bottom:8px;">${formatMad(a.reste)}</div>
              <a href="${link}" style="display:inline-block;background:#0E7C7B;color:#ffffff;text-decoration:none;font-size:12.5px;font-weight:bold;padding:8px 14px;border-radius:8px;">
                Voir le dossier
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function section(title: string, alerts: AlertRow[], appUrl: string): string {
  if (alerts.length === 0) return "";
  return `
    <tr>
      <td style="padding:16px 16px 8px;font-family:Arial,sans-serif;font-size:12.5px;font-weight:bold;color:#5B6072;text-transform:uppercase;letter-spacing:0.03em;">
        ${title} (${alerts.length})
      </td>
    </tr>
    <tr><td style="padding:0 16px 8px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E3E5EA;border-radius:10px;overflow:hidden;">
        ${alerts.map((a) => row(a, appUrl)).join("")}
      </table>
    </td></tr>
  `;
}

export function buildDigestEmailHtml(
  mesDossiers: AlertRow[],
  nonAssignes: AlertRow[],
  appUrl: string
): string {
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const total = mesDossiers.length + nonAssignes.length;

  const body =
    total === 0
      ? `
        <tr>
          <td style="padding:32px 16px;text-align:center;background:#ffffff;">
            <div style="font-size:15px;font-weight:bold;color:#1F8A55;">Rien à signaler aujourd'hui 🎉</div>
            <div style="font-size:12.5px;color:#5B6072;margin-top:6px;">Aucun dossier en retard.</div>
          </td>
        </tr>
      `
      : section("Vos dossiers prioritaires", mesDossiers, appUrl) +
        section("Non assignés — à prendre en charge", nonAssignes, appUrl);

  return `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#F5F6F8;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6F8;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#14161F;padding:20px 24px;">
                <span style="color:#ffffff;font-size:15px;font-weight:bold;">Suivi Référencement</span>
                <span style="color:#B8BCC9;font-size:12px;"> — Telecontact / Edicom</span>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 4px;">
                <div style="font-size:12.5px;color:#5B6072;text-transform:capitalize;">${today}</div>
                <div style="font-size:17px;font-weight:bold;color:#12131A;margin-top:4px;">
                  ${total > 0 ? `${total} dossier${total > 1 ? "s" : ""} nécessite${total > 1 ? "nt" : ""} une action` : "Tout est à jour"}
                </div>
              </td>
            </tr>
            ${body}
            <tr>
              <td style="padding:16px 24px 24px;text-align:center;">
                <a href="${appUrl}/dossiers" style="color:#0E7C7B;font-size:12.5px;font-weight:bold;text-decoration:none;">
                  Ouvrir la file d'action →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}
