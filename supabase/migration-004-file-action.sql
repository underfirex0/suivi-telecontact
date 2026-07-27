-- ============================================================
-- MIGRATION 004 — File d'action : log d'actions, abandon explicite,
-- retrait de l'escalade automatique vers "suivi juridique"
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- Sans danger : n'affecte aucune donnée existante. Les colonnes
-- juridique_actif restent inchangées (le juridique redevient
-- 100% manuel côté application, aucune migration de données requise).
-- ============================================================

-- ---------- ABANDON EXPLICITE ----------
alter table public.dossiers
  add column if not exists abandonne_at timestamptz,
  add column if not exists abandonne_par uuid references public.profiles(id) on delete set null,
  add column if not exists abandonne_raison text;

-- ---------- SUIVI DE L'ACTIVITÉ (pour la File d'action) ----------
alter table public.dossiers
  add column if not exists derniere_action_at timestamptz,
  add column if not exists prochain_rappel date;

-- ---------- ACTIONS (log des actions humaines : appels, emails, visites...) ----------
create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  type text not null check (type in ('appel', 'email', 'visite', 'promesse_paiement', 'autre')),
  resultat text,
  note text,
  date_rappel date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists actions_dossier_idx on public.actions(dossier_id);

-- Met à jour automatiquement le dossier avec la date de la dernière action
-- et le prochain rappel prévu, dès qu'une action est enregistrée.
create or replace function public.recompute_derniere_action()
returns trigger
language plpgsql
as $$
begin
  update public.dossiers
  set
    derniere_action_at = now(),
    prochain_rappel = new.date_rappel
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

alter publication supabase_realtime add table public.actions;
