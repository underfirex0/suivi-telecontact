-- ============================================================
-- MIGRATION 011 — Société / Support / Édition
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- Sans danger : tous les dossiers existants prennent automatiquement les
-- valeurs par défaut (Telecontact / Internet / sans édition), ce qui est exact
-- pour tout ce qui a été importé jusqu'ici. Le fichier
-- backfill-tags-existants.sql (à lancer ENSUITE) précise l'édition de chacun.
-- Relançable sans effet secondaire.
-- ============================================================

-- ---------- Tags sur les dossiers ----------
alter table public.dossiers
  add column if not exists societe text not null default 'telecontact',
  add column if not exists support text not null default 'internet',
  add column if not exists edition integer,
  add column if not exists ordre text,
  add column if not exists code_firme text;

alter table public.dossiers drop constraint if exists dossiers_societe_check;
alter table public.dossiers
  add constraint dossiers_societe_check check (societe in ('telecontact', 'kompass'));

alter table public.dossiers drop constraint if exists dossiers_support_check;
alter table public.dossiers
  add constraint dossiers_support_check check (support in ('internet', 'papier'));

create index if not exists dossiers_scope_idx on public.dossiers (societe, edition, support);
create index if not exists dossiers_facture_idx on public.dossiers (numero_facture);

-- ---------- Éditions ----------
-- Une édition = un numéro par société (Telecontact 34, 35, 36, 37... Kompass 40, 41...).
-- date_sortie_annuaire : pour le PAPIER, la facture part quand l'annuaire sort en vente.
create table if not exists public.editions (
  id uuid primary key default gen_random_uuid(),
  societe text not null check (societe in ('telecontact', 'kompass')),
  numero integer not null,
  statut text not null default 'en_cours' check (statut in ('en_cours', 'terminee')),
  date_sortie_annuaire date,
  created_at timestamptz not null default now(),
  unique (societe, numero)
);

alter table public.editions enable row level security;

drop policy if exists "editions_all_authenticated" on public.editions;
create policy "editions_all_authenticated"
  on public.editions for all
  to authenticated
  using (true)
  with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'editions'
  ) then
    alter publication supabase_realtime add table public.editions;
  end if;
end $$;

-- Éditions connues à ce jour (34 et 35 sont terminées, comme indiqué).
insert into public.editions (societe, numero, statut) values
  ('telecontact', 34, 'terminee'),
  ('telecontact', 35, 'terminee'),
  ('telecontact', 36, 'en_cours'),
  ('telecontact', 37, 'en_cours'),
  ('kompass', 40, 'en_cours'),
  ('kompass', 41, 'en_cours')
on conflict (societe, numero) do nothing;

-- Toute édition déjà présente dans les dossiers mais absente de la liste ci-dessus
insert into public.editions (societe, numero)
select distinct societe, edition from public.dossiers where edition is not null
on conflict (societe, numero) do nothing;
