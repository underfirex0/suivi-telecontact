-- ============================================================
-- MIGRATION 002 — Archivage (suppression douce) des dossiers
-- À exécuter une seule fois dans Supabase > SQL Editor > Run
-- Sans danger : n'affecte aucune donnée existante.
-- ============================================================

alter table public.dossiers
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

create index if not exists dossiers_archived_idx on public.dossiers(archived_at);
