import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec la clé "service role" — contourne les règles RLS.
 * À utiliser UNIQUEMENT côté serveur (routes API, cron jobs), jamais dans
 * un composant client. La clé ne doit jamais être préfixée NEXT_PUBLIC_.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
