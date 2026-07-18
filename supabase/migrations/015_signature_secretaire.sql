-- =============================================================================
-- Migration 015 — le secrétaire peut faire signer (point 2)
--
-- Art. 14/15 : le secrétaire tient le registre. Arbitrage Pascal : il peut, comme
-- le président, préparer les demandes de signature. Jusqu'ici l'écriture sur
-- signature_batches était réservée au président (write_admin générique).
--
-- On AJOUTE deux policies permissives pour le secrétaire (les permissives se
-- cumulent en OU, write_admin reste en place pour le président) :
--   - INSERT : créer un lot (createSignatureBatch).
--   - UPDATE : marquer un lot signé (markBatchSigned).
-- Pas de DELETE : aucun flux ne supprime un lot, ni pour le président ni pour le
-- secrétaire. Le trésorier n'a rien ici (il ne gère que l'argent).
--
-- Dépend de is_secretaire() (migration 014). INERTE tant qu'aucun membre n'est
-- secrétaire.
-- =============================================================================

drop policy if exists "signature_batches_secretaire_insert" on signature_batches;
create policy "signature_batches_secretaire_insert" on signature_batches
  for insert to authenticated
  with check (is_secretaire());

drop policy if exists "signature_batches_secretaire_update" on signature_batches;
create policy "signature_batches_secretaire_update" on signature_batches
  for update to authenticated
  using (is_secretaire())
  with check (is_secretaire());
