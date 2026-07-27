-- ============================================================
-- MIGRATION 005 — Détection des promesses de paiement rompues
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- Sans danger : n'affecte aucune donnée existante.
-- ============================================================

alter table public.dossiers
  add column if not exists dernier_type_action text;

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
