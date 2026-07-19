-- =============================================================================
-- SEED STAGING — jeu de données de recette (UAT) pour l'environnement de test.
--
-- ⚠️ À N'EXÉCUTER QUE SUR LE PROJET SUPABASE *STAGING*, JAMAIS SUR LA PROD.
--    (La prod est un registre légal — aucune donnée fictive n'y a sa place.)
--
-- Prérequis : `schema.sql` déjà exécuté sur ce projet (tables + RLS + bucket).
-- Ce script tourne en service_role dans le SQL Editor → il contourne la RLS.
--
-- Objectif : cinq membres (un par rôle à tester) + de quoi voter réellement,
-- pour valider les DROITS sous la vraie RLS — ce que ni l'admin (tous droits)
-- ni le backend mock (RLS non implémentée) ne peuvent montrer.
--
-- Emails : alias Gmail « +tag » d'une seule boîte (pfavre25@gmail.com). Ils
-- arrivent tous dans la même messagerie → Pascal reçoit chaque mail de reset et
-- peut se connecter en tant que chaque rôle. TOUS EN MINUSCULES : une majuscule
-- casserait current_membre_id() (cf. bug prod du 2026-07-19, membre « Marc »).
--
-- ⚠️ Après ce seed : créer les comptes correspondants dans
--    Authentication > Users (mêmes emails, minuscules, « Auto Confirm »).
--    Sans compte Auth, le membre existe en base mais ne peut pas se connecter.
--
-- Idempotent : UUID fixes + `on conflict (id) do nothing`. Réexécutable.
-- Repartir de zéro : `nettoyage.sql` puis ce script (sur STAGING uniquement).
-- =============================================================================

-- --------------------------------------------------------------- Membres du CS
-- Un membre par rôle, pour parcourir chaque chemin de permission.
insert into membres_cs (id, nom, prenom, email, role, date_election, ag_election, actif) values
  ('11111111-1111-1111-1111-111111111111','Test','Président', 'pfavre25+president@gmail.com','president', '2025-06-19','AGO staging', true),
  ('22222222-2222-2222-2222-222222222222','Test','Trésorier', 'pfavre25+tresorier@gmail.com','tresorier', '2025-06-19','AGO staging', true),
  ('33333333-3333-3333-3333-333333333333','Test','Secrétaire','pfavre25+secretaire@gmail.com','secretaire','2025-06-19','AGO staging', true),
  ('44444444-4444-4444-4444-444444444444','Test','Membre Un', 'pfavre25+membre1@gmail.com', 'membre',    '2025-06-19','AGO staging', true),
  ('55555555-5555-5555-5555-555555555555','Test','Membre Deux','pfavre25+membre2@gmail.com','membre',    '2025-06-19','AGO staging', true)
on conflict (id) do nothing;

-- ------------------------------------------------------------------------- AG
insert into assemblees_generales (id, numero, type, date_ag, lieu, statut) values
  ('a0000000-0000-0000-0000-0000000000a1','AGO-STG-01','AGO','2025-06-19','Nernier (staging)','cloturee')
on conflict (id) do nothing;

-- ------------------------------------------------------------------ Résolutions
-- res1 : adoptée + dotée → alloue un budget, rattachée à un projet (ci-dessous).
-- res2 : à voter → NE dote rien (montant = simple proposition tant que non votée).
-- res3 : adoptée + dotée, SANS projet → cible d'un engagement DIRECT du CS.
insert into resolutions_ag (id, ag_id, numero, titre, description, statut, budget_alloue, budget_intitule) values
  ('b0000000-0000-0000-0000-0000000000b1','a0000000-0000-0000-0000-0000000000a1',1,'Réfection du chemin','Travaux de réfection du chemin communal.','adoptee',20000.00,'Réfection chemin'),
  ('b0000000-0000-0000-0000-0000000000b2','a0000000-0000-0000-0000-0000000000a1',2,'Étude clôture','Étude préalable pour la clôture périmétrique.','a_voter',5000.00,'Étude clôture'),
  ('b0000000-0000-0000-0000-0000000000b3','a0000000-0000-0000-0000-0000000000a1',3,'Entretien espaces verts','Enveloppe annuelle d''entretien.','adoptee',8000.00,'Entretien annuel')
on conflict (id) do nothing;

-- --------------------------------------------------------------------- Projet
-- Financé par res1 (c'est la RÉSOLUTION qui pointe le projet). Chef = Membre Un.
insert into projets (id, nom, description, chef_projet_id, date_ouverture) values
  ('c0000000-0000-0000-0000-0000000000c1','Réfection du chemin','Exécution de la résolution n°1.','44444444-4444-4444-4444-444444444444','2025-07-01')
on conflict (id) do nothing;

update resolutions_ag
  set projet_id = 'c0000000-0000-0000-0000-0000000000c1'
  where id = 'b0000000-0000-0000-0000-0000000000b1';

-- ------------------------------------------------------------------ Décisions
-- Deux décisions VIVANTES (en_cours, non enregistrées, sans vote) : c'est le
-- cœur de l'UAT — chaque testeur vote son propre vote et pose ses questions.
--   dec1 : engagement via le PROJET (12 000 € sur les 20 000 alloués).
--   dec2 : engagement DIRECT sur res3 (3 000 € sur les 8 000 alloués).
-- Quorum interne : > 50 % des 5 membres actifs → il faut ≥ 3 votants.
insert into decisions
  (id, numero, titre, description, date_publication, date_limite_reponse, statut, enregistree, montant_engage, projet_id, resolution_id, created_by) values
  ('d0000000-0000-0000-0000-0000000000d1','2025-001','Devis entreprise pour le chemin','Engager 12 000 € pour le lot terrassement du chemin.','2025-07-10','2025-07-21','en_cours',false,12000.00,'c0000000-0000-0000-0000-0000000000c1',null,'11111111-1111-1111-1111-111111111111'),
  ('d0000000-0000-0000-0000-0000000000d2','2025-002','Contrat entretien espaces verts','Engager 3 000 € au titre de l''entretien annuel (res. 3).','2025-07-12','2025-07-23','en_cours',false,3000.00,null,'b0000000-0000-0000-0000-0000000000b3','44444444-4444-4444-4444-444444444444')
on conflict (id) do nothing;
