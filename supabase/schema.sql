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
  montant_recu numeric(12,2) not null default 0,
  date_paiement date,

  date_debut_visibilite date,
  date_fin_visibilite date,

  numero_facture text,
  ville text,
  courriel_niveau smallint check (courriel_niveau in (1, 2, 3)),

  abandonne_at timestamptz,
  abandonne_par uuid references public.profiles(id) on delete set null,
  abandonne_raison text,

  derniere_action_at timestamptz,
  prochain_rappel date,
  dernier_type_action text,

  juridique_actif boolean not null default false,
  juridique_notes text,
  juridique_etape text default 'en_attente'
    check (juridique_etape in (
      'en_attente', 'mise_en_demeure_edicom', 'mise_en_demeure_avocat',
      'assignation', 'jugement', 'execution', 'clos'
    )),
  juridique_etape_maj_at timestamptz,
  date_mise_en_demeure date,
  date_mise_en_demeure_avocat date,
  date_assignation date,
  date_jugement date,
  montant_jugement numeric(12,2),
  avocat_referent text,
  reference_tribunal text,

  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete set null,

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

-- ---------- PAIEMENTS (ledger — plusieurs paiements partiels par dossier) ----------
create table if not exists public.paiements (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  montant numeric(12,2) not null,
  date_paiement date not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists paiements_dossier_idx on public.paiements(dossier_id);

-- Recalcule automatiquement dossiers.montant_recu à chaque ajout/modif/suppression
-- de paiement, et fait passer le dossier en "payé" dès que le montant reçu couvre
-- le montant facturé (et inversement si un paiement est corrigé/supprimé).
create or replace function public.recompute_montant_recu()
returns trigger
language plpgsql
as $$
declare
  v_dossier_id uuid;
  v_total numeric(12,2);
  v_facture numeric(12,2);
  v_etape text;
begin
  v_dossier_id := coalesce(new.dossier_id, old.dossier_id);

  select coalesce(sum(montant), 0) into v_total
  from public.paiements
  where dossier_id = v_dossier_id;

  select montant_facture, etape into v_facture, v_etape
  from public.dossiers
  where id = v_dossier_id;

  update public.dossiers
  set
    montant_recu = v_total,
    etape = case
      when v_facture is not null and v_total >= v_facture and v_etape = 'paiement' then 'paye'
      when v_facture is not null and v_total < v_facture and v_etape = 'paye' then 'paiement'
      else v_etape
    end,
    date_paiement = case
      when v_facture is not null and v_total >= v_facture and v_etape = 'paiement' then current_date
      when v_facture is not null and v_total < v_facture and v_etape = 'paye' then null
      else date_paiement
    end
  where id = v_dossier_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists paiements_recompute on public.paiements;
create trigger paiements_recompute
  after insert or update or delete on public.paiements
  for each row execute procedure public.recompute_montant_recu();

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

alter table public.paiements enable row level security;

drop policy if exists "paiements_all_authenticated" on public.paiements;
create policy "paiements_all_authenticated"
  on public.paiements for all
  to authenticated
  using (true)
  with check (true);

-- ---------- ACTIONS (log des actions humaines : appels, emails, visites...) ----------
create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  type text not null check (type in ('appel', 'email', 'visite', 'promesse_paiement', 'autre')),
  resultat text,
  sous_statut text,
  note text,
  date_rappel date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists actions_dossier_idx on public.actions(dossier_id);

create or replace function public.recompute_derniere_action()
returns trigger
language plpgsql
as $$
begin
  update public.dossiers
  set
    derniere_action_at = now(),
    prochain_rappel = new.date_rappel,
    dernier_type_action = new.type
  where id = new.dossier_id;
  return new;
end;
$$;

drop trigger if exists actions_recompute on public.actions;
create trigger actions_recompute
  after insert on public.actions
  for each row execute procedure public.recompute_derniere_action();

alter table public.actions enable row level security;

drop policy if exists "actions_all_authenticated" on public.actions;
create policy "actions_all_authenticated"
  on public.actions for all
  to authenticated
  using (true)
  with check (true);

-- ---------- REALTIME ----------
-- Permet au dashboard de se mettre à jour en direct pour tous les opérateurs
alter publication supabase_realtime add table public.dossiers;
alter publication supabase_realtime add table public.historique;
alter publication supabase_realtime add table public.paiements;
alter publication supabase_realtime add table public.actions;

-- ---------- IMPORTS (historique des injections hebdomadaires de fichiers) ----------
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
