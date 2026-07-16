-- =============================================================================
-- Migration 008 — le verrou d'enregistrement s'applique aussi au DELETE
--
-- Règle (arbitrage Pascal 2026-07-16) : le président peut supprimer une décision
-- tant qu'elle n'est PAS enregistrée et qu'au plus UN membre a voté. Une décision
-- enregistrée est inscrite au registre légal : elle n'est plus effaçable.
--
-- Le trou : `write_admin` est un `for all using (is_admin())` — il couvre le
-- DELETE sans aucune garde sur `enregistree`. Au niveau Postgres, le président
-- pouvait donc supprimer une décision enregistrée. Ce qui l'en empêchait était
-- (a) l'UI, et (b) le rejet applicatif « aucun vote » — une décision enregistrée
-- ayant forcément des votes (quorum oblige), elle était bloquée par RICOCHET.
-- Ce filet disparaît maintenant que la suppression est tolérée jusqu'à 1 vote.
--
-- Une policy permissive de plus ne servirait à rien : les permissives se cumulent
-- en OU, `write_admin` ré-ouvrirait le DELETE. D'où `as restrictive`, qui se
-- combine en ET avec toutes les autres : quelles que soient les permissives, un
-- DELETE sur une décision enregistrée est refusé.
--
-- Le seuil « au plus 1 vote » n'est volontairement PAS porté en base : c'est un
-- garde-fou de saisie, pas une règle statutaire. Seul le verrou légal est doublé ici.
-- =============================================================================

drop policy if exists "decisions_no_delete_enregistree" on decisions;
create policy "decisions_no_delete_enregistree" on decisions
  as restrictive for delete to authenticated
  using (enregistree = false);
