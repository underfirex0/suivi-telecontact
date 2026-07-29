-- ============================================================
-- MIGRATION 006 — Suivi juridique structuré
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- Sans danger : n'affecte aucune donnée existante. Les dossiers
-- déjà marqués juridique_actif passent automatiquement à l'étape
-- "mise_en_demeure" par défaut (à ajuster manuellement si besoin).
-- ============================================================

alter table public.dossiers
  add column if not exists juridique_etape text default 'mise_en_demeure'
    check (juridique_etape in ('mise_en_demeure', 'assignation', 'jugement', 'execution', 'clos')),
  add column if not exists juridique_etape_maj_at timestamptz,
  add column if not exists date_mise_en_demeure date,
  add column if not exists date_assignation date,
  add column if not exists date_jugement date,
  add column if not exists montant_jugement numeric(12,2),
  add column if not exists avocat_referent text,
  add column if not exists reference_tribunal text;

update public.dossiers
set juridique_etape_maj_at = now()
where juridique_actif = true and juridique_etape_maj_at is null;
