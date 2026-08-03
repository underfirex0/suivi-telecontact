-- ============================================================
-- MIGRATION 007 — Niveau de courriel de relance (1/2/3)
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- ============================================================

alter table public.dossiers
  add column if not exists courriel_niveau smallint check (courriel_niveau in (1, 2, 3));
