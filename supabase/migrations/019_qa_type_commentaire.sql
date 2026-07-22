-- =============================================================================
-- Migration 019 — un troisième type de fil : 'commentaire'
--
-- `questions_reponses.type` portait 'question' (attend une réponse) et 'reponse'.
-- Manquait le COMMENTAIRE : une note de SUIVI, postée APRÈS le vote, lors de la
-- mise en œuvre de la décision. Distinction voulue par Pascal :
--   - Q&A précède le vote (délibération).
--   - le commentaire vient après (exécution).
--
-- Conséquence importante : un commentaire n'attend PAS de réponse, il ne doit
-- donc jamais être compté comme « question sans réponse » sur la liste du
-- registre. Le décompte (RegistreCS) ne regarde que type='question' — cette
-- migration lui donne juste un troisième type légitime à stocker.
--
-- Rappel : le mock (mockDb) n'a pas de contrainte, il acceptait déjà 'commentaire'.
-- =============================================================================

alter table questions_reponses drop constraint questions_reponses_type_check;
alter table questions_reponses add constraint questions_reponses_type_check
  check (type in ('question', 'reponse', 'commentaire'));
