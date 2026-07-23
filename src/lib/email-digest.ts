import type { DossierStatus } from "./types";

interface AlertRow {
  clientNom: string;
  offre: string | null;
  status: DossierStatus;
  dossierId: string;
}

const HEX: Record<DossierStatus["color"], string> = {
  neutral: "#6B7280",
  warning: "#C2790A",
  danger: "#C0392B",
  juridique: "#5B3A8E",
  success: "#1F8A55",
};

function row(a: AlertRow, appUrl: string): string {
  const color = HEX[a.status.color];
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
            <td style="text-align:right;vertical-align:middle;">
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

export function buildDigestEmailHtml(alerts: AlertRow[], appUrl: string): string {
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const body =
    alerts.length === 0
      ? `
        <tr>
          <td style="padding:32px 16px;text-align:center;background:#ffffff;">
            <div style="font-size:15px;font-weight:bold;color:#1F8A55;">Rien à signaler aujourd'hui 🎉</div>
            <div style="font-size:12.5px;color:#5B6072;margin-top:6px;">Aucun dossier en retard.</div>
          </td>
        </tr>
      `
      : alerts.map((a) => row(a, appUrl)).join("");

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
                  ${alerts.length > 0 ? `${alerts.length} dossier${alerts.length > 1 ? "s" : ""} nécessite${alerts.length > 1 ? "nt" : ""} une action` : "Tout est à jour"}
                </div>
              </td>
            </tr>
            <tr><td style="padding:8px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E3E5EA;border-radius:10px;overflow:hidden;">
                ${body}
              </table>
            </td></tr>
            <tr>
              <td style="padding:16px 24px 24px;text-align:center;">
                <a href="${appUrl}/dashboard" style="color:#0E7C7B;font-size:12.5px;font-weight:bold;text-decoration:none;">
                  Ouvrir le tableau de bord →
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
