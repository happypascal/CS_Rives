-- =============================================================================
-- Migration 022 — heures d'assemblée générale
--
-- Deux heures, stockées en TEXT « HH:MM » (aucun calcul horaire — l'app affiche,
-- ne compte pas) :
--   - heure_planifiee : heure prévue à la convocation (début).
--   - heure_fin       : heure effective de fin de séance, renseignée à la clôture.
--
-- La clôture de l'AG (statut 'cloturee') exige que heure_fin soit renseignée — la
-- garde est côté application (bouton « Clôturer l'AG »).
-- =============================================================================

alter table assemblees_generales add column if not exists heure_planifiee text;
alter table assemblees_generales add column if not exists heure_fin text;
