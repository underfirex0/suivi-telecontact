-- ============================================================
-- MIGRATION 008 — Nouvelles étapes de suivi juridique
-- Ancien : mise_en_demeure → assignation → jugement → execution → clos
-- Nouveau : en_attente → mise_en_demeure_edicom → mise_en_demeure_avocat
--           → assignation → jugement → execution → clos
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- ============================================================

-- Nouvelle date pour la mise en demeure envoyée par un avocat
-- (date_mise_en_demeure existant reste utilisé pour la mise en demeure Edicom).
alter table public.dossiers
  add column if not exists date_mise_en_demeure_avocat date;

-- Retire l'ancienne contrainte pour pouvoir migrer les valeurs existantes.
alter table public.dossiers drop constraint if exists dossiers_juridique_etape_check;

-- Les dossiers déjà à l'ancienne étape "mise_en_demeure" (mise en demeure
-- envoyée, sans précision) sont considérés comme envoyés par Edicom —
-- l'interprétation la plus fidèle à l'ancien libellé "Mise en demeure envoyée".
update public.dossiers
set juridique_etape = 'mise_en_demeure_edicom'
where juridique_etape = 'mise_en_demeure';

-- Nouvelle contrainte avec les étapes à jour.
alter table public.dossiers
  add constraint dossiers_juridique_etape_check
  check (juridique_etape in (
    'en_attente', 'mise_en_demeure_edicom', 'mise_en_demeure_avocat',
    'assignation', 'jugement', 'execution', 'clos'
  ));

alter table public.dossiers alter column juridique_etape set default 'en_attente';
