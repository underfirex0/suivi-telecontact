import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeDossier, scoreFileAction } from "@/lib/dossier-logic";
import { buildDigestEmailHtml } from "@/lib/email-digest";
import { SOCIETE_LABELS, SUPPORT_LABELS, editionBadge } from "@/lib/tags";
import type { Dossier, Edition } from "@/lib/types";

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
    .is("archived_at", null)
    .is("abandonne_at", null);

  if (dossiersError) {
    return NextResponse.json({ error: dossiersError.message }, { status: 500 });
  }

  // Éditions : nécessaires pour les alertes papier (date de sortie de l'annuaire).
  // Si la table est absente, on continue avec une liste vide plutôt que de bloquer l'e-mail.
  const { data: editionsData } = await supabase.from("editions").select("*");
  const analyzeCtx = { editions: (editionsData ?? []) as Edition[] };

  const { data: profilesData, error: profilesError } = await supabase.from("profiles").select("*");
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }
  const profileById = new Map((profilesData ?? []).map((p) => [p.id, p]));

  // Les éditions terminées (ex : 34, 35) restent visibles dans l'application mais ne noient plus
  // l'e-mail quotidien : elles sont résumées en une seule ligne.
  const editionsTerminees = new Set(
    analyzeCtx.editions.filter((e) => e.statut === "terminee").map((e) => `${e.societe}|${e.numero}`)
  );
  const estTerminee = (d: Dossier) => d.edition != null && editionsTerminees.has(`${d.societe}|${d.edition}`);

  const now = new Date();
  const toutesAlertes = ((dossiersData ?? []) as Dossier[])
    .map((d) => ({ d, a: analyzeDossier(d, now, analyzeCtx) }))
    .filter((x) => x.a.alert);
  const nbEditionsTerminees = toutesAlertes.filter((x) => estTerminee(x.d)).length;
  const alerts = toutesAlertes
    .filter((x) => !estTerminee(x.d))
    .sort((x, y) => scoreFileAction(y.d, y.a) - scoreFileAction(x.d, x.a))
    .map((x) => ({
      clientNom: x.d.client_nom,
      offre: x.d.offre,
      tag: `${SOCIETE_LABELS[x.d.societe]} · ${editionBadge(x.d.edition)} · ${SUPPORT_LABELS[x.d.support]}`,
      status: x.a,
      dossierId: x.d.id,
      reste: Math.max(0, (x.d.montant_facture ?? 0) - x.d.montant_recu),
      operateurId: x.d.operateur_id,
    }));

  const nonAssignes = alerts.filter((a) => !a.operateurId);

  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  let sentCount = 0;
  const errors: string[] = [];

  for (const user of usersData?.users ?? []) {
    if (!user.email) continue;
    const profile = profileById.get(user.id);
    const mesDossiers = alerts.filter((a) => a.operateurId === user.id);
    const total = mesDossiers.length + nonAssignes.length;

    const subject =
      total > 0
        ? `📋 ${mesDossiers.length} dossier${mesDossiers.length > 1 ? "s" : ""} à vous — Suivi Référencement`
        : "📋 Suivi Référencement — Tout est à jour ✅";

    const html = buildDigestEmailHtml(mesDossiers, nonAssignes, appUrl, nbEditionsTerminees);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [user.email],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text();
      errors.push(`${profile?.full_name ?? user.email}: ${detail}`);
    } else {
      sentCount++;
    }
  }

  return NextResponse.json({
    sent: sentCount > 0,
    recipientCount: sentCount,
    alertCount: alerts.length,
    editionsTermineesCount: nbEditionsTerminees,
    nonAssignesCount: nonAssignes.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
