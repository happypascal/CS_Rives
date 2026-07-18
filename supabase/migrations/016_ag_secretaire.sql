-- =============================================================================
-- Migration 016 — le secrétaire gère les AG et leurs résolutions (point 5)
--
-- Art. 14 : le secrétaire tient les assemblées. Il peut créer/modifier une AG et
-- ses résolutions (l'ordre du jour et les résultats transcrits au PV). Jusqu'ici
-- l'écriture était réservée au président (write_admin générique).
--
-- On AJOUTE des policies permissives pour le secrétaire (cumul en OU avec
-- write_admin, le président garde tout) :
--   - assemblees_generales : INSERT + UPDATE (créer, modifier).
--   - resolutions_ag        : INSERT + UPDATE (ordre du jour, résultats).
-- Pas de DELETE : la suppression d'une AG ou d'une résolution reste au président
-- (comme toute suppression). Le trésorier n'a rien ici (il ne touche qu'aux
-- comptes, migration 017).
--
-- Dépend de is_secretaire() (migration 014). INERTE tant qu'aucun membre n'est
-- secrétaire.
-- =============================================================================

drop policy if exists "ag_secretaire_insert" on assemblees_generales;
create policy "ag_secretaire_insert" on assemblees_generales
  for insert to authenticated with check (is_secretaire());

drop policy if exists "ag_secretaire_update" on assemblees_generales;
create policy "ag_secretaire_update" on assemblees_generales
  for update to authenticated using (is_secretaire()) with check (is_secretaire());

drop policy if exists "resolutions_secretaire_insert" on resolutions_ag;
create policy "resolutions_secretaire_insert" on resolutions_ag
  for insert to authenticated with check (is_secretaire());

drop policy if exists "resolutions_secretaire_update" on resolutions_ag;
create policy "resolutions_secretaire_update" on resolutions_ag
  for update to authenticated using (is_secretaire()) with check (is_secretaire());
