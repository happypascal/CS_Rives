-- =============================================================================
-- Migration 024 — TVA sur l'engagement d'une décision
--
-- Le devis est saisi tel quel dans `montant_engage`. On ajoute :
--   - tva_taux    : taux applicable, saisi manuellement (0 / 5.5 / 10 / 20…).
--   - tva_incluse : le montant saisi inclut-il déjà la TVA (TTC) ou non (HT) ?
--
-- L'app calcule le TTC (le budget d'AG étant TTC) : TTC = tva_incluse ?
-- montant_engage : montant_engage × (1 + tva_taux/100). Les budgets consolidés et
-- le restant des projets utilisent ce TTC. Ce n'est PAS de la comptabilité (le
-- syndic la fait) : juste des décisions informées + un budget restant juste.
--
-- Colonnes nullables : les décisions existantes (tva_incluse NULL) sont traitées
-- comme TTC (montant tel quel) — aucun gonflement rétroactif des budgets.
-- =============================================================================

alter table decisions add column if not exists tva_taux numeric(5,2);
alter table decisions add column if not exists tva_incluse boolean;
