-- ============================================================
-- Suivi Référencement Telecontact/Edicom — Schéma Supabase
-- Copier-coller ce fichier entier dans Supabase > SQL Editor > Run
-- ============================================================

-- Extension pour uuid
create extension if not exists "pgcrypto";

-- ---------- PROFILES ----------
-- Un profil par utilisateur (créé automatiquement à l'inscription)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

-- Fonction + trigger : crée automatiquement un profil quand un compte est créé
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- DOSSIERS ----------
create table if not exists public.dossiers (
  id uuid primary key default gen_random_uuid(),
  client_nom text not null,
  offre text,
  contact_client text,
  commercial text,
  date_bc date not null,

  etape text not null default 'qc' check (etape in ('qc', 'facturation', 'paiement', 'paye')),
  qc_sous_statut text not null default 'attente' check (qc_sous_statut in ('attente', 'a_corriger', 'ok')),
  date_qc date,

  date_facture date,
  montant_facture numeric(12,2),
  date_paiement date,

  juridique_actif boolean not null default false,
  juridique_notes text,

  notes text,
  operateur_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dossiers_etape_idx on public.dossiers(etape);
create index if not exists dossiers_client_idx on public.dossiers(client_nom);

-- auto update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dossiers_set_updated_at on public.dossiers;
create trigger dossiers_set_updated_at
  before update on public.dossiers
  for each row execute procedure public.set_updated_at();

-- ---------- HISTORIQUE ----------
create table if not exists public.historique (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  auteur_id uuid references public.profiles(id) on delete set null,
  texte text not null,
  created_at timestamptz not null default now()
);

create index if not exists historique_dossier_idx on public.historique(dossier_id);

-- ---------- ROW LEVEL SECURITY ----------
-- Tout le monde qui est connecté a accès à tout (comme demandé : comptes
-- individuels pour la traçabilité, mais aucune restriction de droits).

alter table public.profiles enable row level security;
alter table public.dossiers enable row level security;
alter table public.historique enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

drop policy if exists "dossiers_all_authenticated" on public.dossiers;
create policy "dossiers_all_authenticated"
  on public.dossiers for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "historique_all_authenticated" on public.historique;
create policy "historique_all_authenticated"
  on public.historique for all
  to authenticated
  using (true)
  with check (true);

-- ---------- REALTIME ----------
-- Permet au dashboard de se mettre à jour en direct pour tous les opérateurs
alter publication supabase_realtime add table public.dossiers;
alter publication supabase_realtime add table public.historique;
