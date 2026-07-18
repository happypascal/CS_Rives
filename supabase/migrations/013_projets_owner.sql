-- =============================================================================
-- Migration 013 — RLS : le chef de projet modifie son projet
--
-- Règle (arbitrage Pascal 2026-07-18) : tout membre actif peut créer un projet
-- EN TANT QUE chef de projet (chef_projet_id = lui) et le modifier. Les autres
-- membres ne le modifient pas. Le président garde tout (write_admin) : il crée,
-- assigne le chef, et la suppression lui reste réservée (garde
-- projets_delete_guard, migration 010).
--
-- La permission s'ancre sur `chef_projet_id`, PAS sur un created_by séparé :
-- quand le président crée un projet et désigne un membre comme chef, ce membre
-- doit pouvoir le modifier — un created_by (= le président, créateur) le lui
-- aurait interdit. Le chef de projet est donc à la fois le rôle fonctionnel et
-- l'ancre de permission. Aucune colonne ajoutée.
--
-- INSERT : un membre ne crée qu'un projet dont il est le chef (chef_projet_id =
-- son id). Le président (write_admin) crée avec n'importe quel chef, ou aucun.
-- UPDATE : le chef modifie. Le `with check` l'empêche de se dessaisir en
-- réassignant le chef à autrui (seul le président réassigne).
--
-- Purement des policies (pas de changement de schéma) → peut être appliquée sans
-- coordination ; elle ne fait qu'OUVRIR l'écriture aux chefs, le flux président
-- (write_admin) est inchangé.
--
-- ⚠ AUTO-CORRECTIVE : une première version de cette migration ajoutait une
-- colonne `created_by` + des policies `projets_owner_*` (approche abandonnée au
-- profit de chef_projet_id). Le bloc ci-dessous les retire si elles existent. La
-- colonne created_by n'a JAMAIS été alimentée (le code correspondant n'a pas été
-- déployé) → sa suppression ne perd aucune donnée. Idempotent quoi qu'il arrive.
-- =============================================================================

drop policy if exists "projets_owner_insert" on projets;
drop policy if exists "projets_owner_update" on projets;
alter table projets drop column if exists created_by;

drop policy if exists "projets_chef_insert" on projets;
create policy "projets_chef_insert" on projets for insert to authenticated
  with check (
    chef_projet_id = current_membre_id()
    and exists (select 1 from membres_cs m where m.id = current_membre_id() and m.actif)
  );

drop policy if exists "projets_chef_update" on projets;
create policy "projets_chef_update" on projets for update to authenticated
  using (chef_projet_id = current_membre_id())
  with check (chef_projet_id = current_membre_id());

-- Pas de policy chef pour le DELETE : la suppression reste au président
-- (write_admin), doublée du trigger projets_delete_guard. Le chef ne supprime pas.
