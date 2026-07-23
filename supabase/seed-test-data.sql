-- ============================================================
-- RESET + JEU DE DONNÉES DE TEST
-- Supprime tous les dossiers/historique existants (garde les comptes)
-- puis crée 12 dossiers, un par statut possible, pour vérification visuelle.
-- Les dates sont relatives à aujourd'hui : ce script reste valable
-- peu importe quand vous le lancez.
-- ============================================================

delete from public.historique;
delete from public.dossiers;

-- TEST 01 — En attente de référencement (BC reçu aujourd'hui)
with ins as (
  insert into public.dossiers (client_nom, offre, contact_client, commercial, date_bc, etape, qc_sous_statut)
  values ('TEST 01 - En attente referencement', 'Référencement standard', 'M. Karim Idrissi', 'Sara', current_date, 'qc', 'attente')
  returning id
)
insert into public.historique (dossier_id, texte) select id, 'Dossier créé (BC signé reçu).' from ins;

-- TEST 02 — Référencé, prêt pour QC (pas en retard)
with ins as (
  insert into public.dossiers (client_nom, offre, contact_client, commercial, date_bc, etape, qc_sous_statut)
  values ('TEST 02 - Pret pour QC', 'Référencement standard', 'Mme Nadia Alami', 'Sara', current_date - interval '1 day', 'qc', 'attente')
  returning id
)
insert into public.historique (dossier_id, texte) select id, 'Dossier créé (BC signé reçu).' from ins;

-- TEST 03 — QC EN RETARD (référencé depuis 3 jours, seuil = 2j)
with ins as (
  insert into public.dossiers (client_nom, offre, contact_client, commercial, date_bc, etape, qc_sous_statut)
  values ('TEST 03 - QC EN RETARD', 'Référencement premium', 'M. Youssef Bennani', 'Marwane', current_date - interval '4 day', 'qc', 'attente')
  returning id
)
insert into public.historique (dossier_id, texte) select id, 'Dossier créé (BC signé reçu).' from ins;

-- TEST 04 — À corriger, pas encore en retard
with ins as (
  insert into public.dossiers (client_nom, offre, contact_client, commercial, date_bc, etape, qc_sous_statut)
  values ('TEST 04 - A corriger', 'Référencement standard', 'Mme Salma Tazi', 'Sara', current_date - interval '1 day', 'qc', 'a_corriger')
  returning id
)
insert into public.historique (dossier_id, texte) select id, 'Contrôle qualité : corrections demandées.' from ins;

-- TEST 05 — À corriger ET en retard
with ins as (
  insert into public.dossiers (client_nom, offre, contact_client, commercial, date_bc, etape, qc_sous_statut)
  values ('TEST 05 - A corriger EN RETARD', 'Référencement premium', 'M. Omar Fassi', 'Marwane', current_date - interval '4 day', 'qc', 'a_corriger')
  returning id
)
insert into public.historique (dossier_id, texte) select id, 'Contrôle qualité : corrections demandées.' from ins;

-- TEST 06 — Validé, à facturer
with ins as (
  insert into public.dossiers (client_nom, offre, contact_client, commercial, date_bc, etape, qc_sous_statut, date_qc)
  values ('TEST 06 - Valide a facturer', 'Référencement standard', 'Mme Imane Chraibi', 'Sara', current_date - interval '5 day', 'facturation', 'ok', current_date - interval '1 day')
  returning id
)
insert into public.historique (dossier_id, texte) select id, 'Contrôle qualité OK — dossier validé automatiquement.' from ins;

-- TEST 07 — En attente de paiement normal (5j, < seuil 15j)
with ins as (
  insert into public.dossiers (client_nom, offre, contact_client, commercial, date_bc, etape, qc_sous_statut, date_qc, date_facture, montant_facture)
  values ('TEST 07 - Paiement normal', 'Référencement standard', 'M. Hicham Berrada', 'Marwane', current_date - interval '10 day', 'paiement', 'ok', current_date - interval '9 day', current_date - interval '5 day', 3500)
  returning id
)
insert into public.historique (dossier_id, texte) select id, 'Facture envoyée — 3500 MAD.' from ins;

-- TEST 08 — RELANCE NIVEAU 1 (16j, seuil = 15j)
with ins as (
  insert into public.dossiers (client_nom, offre, contact_client, commercial, date_bc, etape, qc_sous_statut, date_qc, date_facture, montant_facture)
  values ('TEST 08 - RELANCE NIVEAU 1', 'Référencement premium', 'Mme Latifa Sqalli', 'Sara', current_date - interval '20 day', 'paiement', 'ok', current_date - interval '19 day', current_date - interval '16 day', 5200)
  returning id
)
insert into public.historique (dossier_id, texte) select id, 'Facture envoyée — 5200 MAD.' from ins;

-- TEST 09 — RELANCE NIVEAU 2 (26j, seuil = 25j)
with ins as (
  insert into public.dossiers (client_nom, offre, contact_client, commercial, date_bc, etape, qc_sous_statut, date_qc, date_facture, montant_facture)
  values ('TEST 09 - RELANCE NIVEAU 2', 'Référencement standard', 'M. Rachid Amrani', 'Marwane', current_date - interval '30 day', 'paiement', 'ok', current_date - interval '29 day', current_date - interval '26 day', 2800)
  returning id
)
insert into public.historique (dossier_id, texte) select id, 'Facture envoyée — 2800 MAD.' from ins;

-- TEST 10 — SUIVI JURIDIQUE AUTOMATIQUE (91j, seuil = 90j)
with ins as (
  insert into public.dossiers (client_nom, offre, contact_client, commercial, date_bc, etape, qc_sous_statut, date_qc, date_facture, montant_facture)
  values ('TEST 10 - JURIDIQUE AUTO', 'Référencement premium', 'Mme Fatiha Naciri', 'Sara', current_date - interval '95 day', 'paiement', 'ok', current_date - interval '94 day', current_date - interval '91 day', 8000)
  returning id
)
insert into public.historique (dossier_id, texte) select id, 'Facture envoyée — 8000 MAD.' from ins;

-- TEST 11 — SUIVI JURIDIQUE ACTIVÉ MANUELLEMENT (seulement 5j, mais forcé)
with ins as (
  insert into public.dossiers (client_nom, offre, contact_client, commercial, date_bc, etape, qc_sous_statut, date_qc, date_facture, montant_facture, juridique_actif, juridique_notes)
  values ('TEST 11 - JURIDIQUE MANUEL', 'Référencement standard', 'M. Anas Sabri', 'Marwane', current_date - interval '10 day', 'paiement', 'ok', current_date - interval '9 day', current_date - interval '5 day', 1500, true, 'Client injoignable, dossier signalé manuellement.')
  returning id
)
insert into public.historique (dossier_id, texte) select id, 'Suivi juridique activé manuellement.' from ins;

-- TEST 12 — PAYÉ (clôturé)
with ins as (
  insert into public.dossiers (client_nom, offre, contact_client, commercial, date_bc, etape, qc_sous_statut, date_qc, date_facture, montant_facture, date_paiement)
  values ('TEST 12 - PAYE', 'Référencement premium', 'Mme Widad Kabbaj', 'Sara', current_date - interval '25 day', 'paye', 'ok', current_date - interval '24 day', current_date - interval '20 day', 4200, current_date - interval '2 day')
  returning id
)
insert into public.historique (dossier_id, texte) select id, 'Paiement reçu — dossier clôturé.' from ins;
