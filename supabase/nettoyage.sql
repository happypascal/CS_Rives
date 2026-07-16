-- =============================================================================
-- NETTOYAGE de la base — repartir sur des données propres.
-- ⚠️ DESTRUCTIF ET IRRÉVERSIBLE. À exécuter dans le SQL Editor.
--
-- Garde UNIQUEMENT le compte président (pour rester connecté et pouvoir tout
-- gérer via l'app). Supprime toutes les données de test et les membres fictifs.
--
-- Le compte de connexion (Authentication > Users) n'est PAS touché par ce script.
-- =============================================================================

-- 1) Données transactionnelles liées aux décisions
delete from votes;
delete from questions_reponses;
delete from decision_status_history;
delete from signature_batches;
delete from audit_log;

-- 2) Décisions, projets, résolutions, AG (dans cet ordre pour les clés étrangères).
-- `projets` avant `resolutions_ag` : c'est la résolution qui pointe le projet
-- (resolutions_ag.projet_id), et son `on delete set null` détache proprement.
delete from decisions;
delete from projets;
delete from resolutions_ag;
delete from assemblees_generales;

-- 3) Membres fictifs (garde le président)
delete from membres_cs where role <> 'president';

-- --------------------------------------------------------------------------
-- VARIANTE : si tu veux GARDER les 4 membres et seulement effacer les données
-- de test (AG / décisions / projets), n'exécute PAS la ligne 3 ci-dessus.
-- --------------------------------------------------------------------------
