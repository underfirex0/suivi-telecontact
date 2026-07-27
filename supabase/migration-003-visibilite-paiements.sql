-- ============================================================
-- MIGRATION 003 — Suivi de la visibilité + paiements partiels
-- À exécuter une seule fois dans Supabase > SQL Editor > Run
-- Sans danger : n'affecte aucune donnée existante.
-- ============================================================

alter table public.dossiers
  add column if not exists montant_recu numeric(12,2) not null default 0,
  add column if not exists date_debut_visibilite date,
  add column if not exists date_fin_visibilite date,
  add column if not exists numero_facture text,
  add column if not exists ville text;

-- Rattrapage : pour les dossiers déjà payés avant cette migration,
-- montant_recu doit être égal au montant facturé (sinon ils seraient
-- signalés à tort comme "perte réelle").
update public.dossiers
set montant_recu = montant_facture
where etape = 'paye' and montant_facture is not null and montant_recu = 0;

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

alter table public.paiements enable row level security;

drop policy if exists "paiements_all_authenticated" on public.paiements;
create policy "paiements_all_authenticated"
  on public.paiements for all
  to authenticated
  using (true)
  with check (true);

alter publication supabase_realtime add table public.paiements;
