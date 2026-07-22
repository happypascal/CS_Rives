-- =============================================================================
-- Migration 020 — statut de résolution 'sans_vote'
--
-- Une résolution inscrite à l'ordre du jour peut être PRÉSENTÉE sans être soumise
-- au vote (reportée, retirée en séance, actée par consensus sans scrutin…). Ce
-- n'est ni 'adoptee', ni 'rejetee', ni 'retiree', ni 'a_voter' (l'AG a eu lieu) :
-- d'où 'sans_vote'.
--
-- Effet budget : AUCUN. Seule une résolution 'adoptee' alloue un budget
-- (cf. ouvreUnBudget / computeAGBudgets) — 'sans_vote' se comporte donc comme
-- rejetee/retiree, rien à changer côté budgets.
-- =============================================================================

alter table resolutions_ag drop constraint resolutions_ag_statut_check;
alter table resolutions_ag add constraint resolutions_ag_statut_check
  check (statut in ('a_voter', 'adoptee', 'rejetee', 'retiree', 'sans_vote'));
