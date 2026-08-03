-- ============================================================
-- MIGRATION 010 — Historique des imports hebdomadaires
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- ============================================================

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,
  fichiers text[] not null default '{}',
  nb_nouveaux_dossiers int not null default 0,
  nb_dossiers_soldes int not null default 0,
  nb_dossiers_partiels int not null default 0,
  montant_total_regle numeric(12,2) not null default 0,
  detail jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.imports enable row level security;

drop policy if exists "imports_all_authenticated" on public.imports;
create policy "imports_all_authenticated"
  on public.imports for all
  to authenticated
  using (true)
  with check (true);

alter publication supabase_realtime add table public.imports;
