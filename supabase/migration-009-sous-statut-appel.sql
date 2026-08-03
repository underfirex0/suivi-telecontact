-- ============================================================
-- MIGRATION 009 — Sous-statut pour les actions de type "Appel"
-- Permet de qualifier précisément le résultat d'un appel :
-- Refuse de payer / Changement date facture / Ne répond plus
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- ============================================================

alter table public.actions
  add column if not exists sous_statut text;
