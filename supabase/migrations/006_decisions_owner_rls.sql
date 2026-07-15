-- =============================================================================
-- Migration 006 — RLS : chaque membre porte ses décisions
--
-- Modèle retenu (arbitrage Pascal 2026-07-15, la spec v2 §5 n'avait jamais été
-- mise à jour) : tout membre actif crée une décision et en devient owner ; seul
-- l'owner la modifie, la notifie et la relance ; le président garde l'acte
-- (enregistrement) et la signature.
--
-- Bug corrigé : l'app posait déjà `created_by` et ouvrait « + Nouvelle
-- décision » à tous, mais la seule policy d'écriture était `write_admin` —
-- un membre non-président se prenait une erreur RLS à l'enregistrement.
--
-- `write_admin` (président = tout) reste en place : les policies permissives
-- se cumulent en OU.
-- =============================================================================

-- Création : tout membre ACTIF, en s'attribuant la décision (pas d'usurpation
-- d'owner possible, created_by est contraint à son propre id).
drop policy if exists "decisions_owner_insert" on decisions;
create policy "decisions_owner_insert" on decisions for insert to authenticated
  with check (
    created_by = current_membre_id()
    and exists (select 1 from membres_cs m where m.id = current_membre_id() and m.actif)
  );

-- Modification : l'owner, tant que la décision n'est pas enregistrée.
-- Le `with check (… enregistree = false)` est ce qui réserve l'acte au
-- président : l'owner ne peut pas poser le verrou lui-même, ni se dessaisir
-- de sa décision en changeant created_by.
drop policy if exists "decisions_owner_update" on decisions;
create policy "decisions_owner_update" on decisions for update to authenticated
  using (created_by = current_membre_id() and enregistree = false)
  with check (created_by = current_membre_id() and enregistree = false);
