-- ============================================================
-- MIGRATION 012 — Module Impayés
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- Tables entièrement séparées des dossiers : rien d'existant n'est modifié.
-- Relançable sans effet secondaire.
-- ============================================================

-- ---------- IMPAYÉS ----------
-- Un impayé = un incident de paiement individuel (facture ou chèque impayé),
-- identifié par le numéro de "Dossier" du fichier source (ex : 28031).
create table if not exists public.impayes (
  id uuid primary key default gen_random_uuid(),
  numero_dossier text not null unique,

  agent text,                                  -- PRECTX, AVOCAT, FERMEE ou un nom (RAMZI...)
  ste_code integer,                            -- code société brut du fichier
  societe text not null default 'telecontact'
    check (societe in ('telecontact', 'kompass', 'autre')),
  sup_code integer,                            -- code support brut du fichier
  support text not null default 'internet'
    check (support in ('internet', 'papier')),
  edition integer,

  ordre text,
  code_firme text,
  client_nom text not null,
  ville text,
  commercial text,
  type text,                                   -- code brut du fichier : F / C

  montant_impaye numeric(12,2) not null default 0,
  montant_recu numeric(12,2) not null default 0,
  reste numeric(12,2) not null default 0,
  date_impaye date,

  -- Suivi de traitement (propriété de l'application après le premier import)
  date_rappel date,
  nbre_appel integer not null default 0,
  nbre_visite integer not null default 0,
  date_prochaine_visite date,
  courrier text,                               -- ex : "CR : 12/09/2024"
  statut text not null default 'ouvert' check (statut in ('ouvert', 'solde', 'clos')),
  raison_cloture text,
  derniere_action_at timestamptz,
  notes text,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists impayes_statut_idx on public.impayes (statut);
create index if not exists impayes_scope_idx on public.impayes (societe, support, edition);

drop trigger if exists impayes_set_updated_at on public.impayes;
create trigger impayes_set_updated_at
  before update on public.impayes
  for each row execute procedure public.set_updated_at();

-- ---------- ACTIONS SUR IMPAYÉS ----------
create table if not exists public.impaye_actions (
  id uuid primary key default gen_random_uuid(),
  impaye_id uuid not null references public.impayes(id) on delete cascade,
  type text not null check (type in ('appel', 'visite', 'courrier', 'promesse', 'autre', 'systeme')),
  resultat text,
  note text,
  date_rappel date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists impaye_actions_impaye_idx on public.impaye_actions (impaye_id);

-- ---------- HISTORIQUE DES IMPORTS D'IMPAYÉS ----------
create table if not exists public.impaye_imports (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,
  fichier text,
  nb_nouveaux integer not null default 0,
  nb_mises_a_jour integer not null default 0,
  nb_soldes integer not null default 0,
  montant_reste_total numeric(14,2) not null default 0,
  detail jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- SÉCURITÉ (même modèle que le reste : tout compte connecté a accès à tout) ----------
alter table public.impayes enable row level security;
alter table public.impaye_actions enable row level security;
alter table public.impaye_imports enable row level security;

drop policy if exists "impayes_all_authenticated" on public.impayes;
create policy "impayes_all_authenticated" on public.impayes
  for all to authenticated using (true) with check (true);

drop policy if exists "impaye_actions_all_authenticated" on public.impaye_actions;
create policy "impaye_actions_all_authenticated" on public.impaye_actions
  for all to authenticated using (true) with check (true);

drop policy if exists "impaye_imports_all_authenticated" on public.impaye_imports;
create policy "impaye_imports_all_authenticated" on public.impaye_imports
  for all to authenticated using (true) with check (true);
