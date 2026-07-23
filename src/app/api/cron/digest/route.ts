import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeDossier } from "@/lib/dossier-logic";
import { buildDigestEmailHtml } from "@/lib/email-digest";
import type { Dossier } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  // Sécurité : seul un appel connaissant CRON_SECRET peut déclencher l'envoi.
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: dossiersData, error: dossiersError } = await supabase
    .from("dossiers")
    .select("*")
    .is("archived_at", null);

  if (dossiersError) {
    return NextResponse.json({ error: dossiersError.message }, { status: 500 });
  }

  const now = new Date();
  const alerts = ((dossiersData ?? []) as Dossier[])
    .map((d) => ({ d, a: analyzeDossier(d, now) }))
    .filter((x) => x.a.alert)
    .sort((x, y) => y.a.severity - x.a.severity)
    .map((x) => ({
      clientNom: x.d.client_nom,
      offre: x.d.offre,
      status: x.a,
      dossierId: x.d.id,
    }));

  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }
  const recipients = (usersData?.users ?? []).map((u) => u.email).filter((e): e is string => !!e);

  if (recipients.length === 0) {
    return NextResponse.json({ sent: false, reason: "Aucun destinataire (aucun compte utilisateur trouvé)." });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const html = buildDigestEmailHtml(alerts, appUrl);
  const subject =
    alerts.length > 0
      ? `📋 Suivi Référencement — ${alerts.length} dossier${alerts.length > 1 ? "s" : ""} nécessite${
          alerts.length > 1 ? "nt" : ""
        } une action`
      : "📋 Suivi Référencement — Tout est à jour ✅";

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: recipients,
      subject,
      html,
    }),
  });

  if (!resendRes.ok) {
    const detail = await resendRes.text();
    return NextResponse.json({ error: "Échec de l'envoi via Resend", detail }, { status: 502 });
  }

  return NextResponse.json({
    sent: true,
    alertCount: alerts.length,
    recipientCount: recipients.length,
  });
}
