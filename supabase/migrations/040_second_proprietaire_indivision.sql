-- =============================================================================
-- Migration 040 — DEUX PROPRIÉTAIRES ≠ INDIVISION
--
-- Correction demandée par Pascal (2026-08-28) : « on a déjà un second
-- propriétaire mais indivision. Il faudrait simplement ajouter une checkbox pour
-- spécifier que c'est une indivision. »
--
-- La 038 avait introduit `nom_2` / `email_2` / `telephone_2` en les appelant
-- « indivision ». C'était présumer la forme juridique : deux personnes peuvent
-- détenir un même bien sans être en indivision — communauté entre époux,
-- tontine, démembrement. Le registre doit CONSTATER qui possède, pas qualifier
-- le régime à la place du notaire.
--
-- D'où la séparation :
--   - `nom_2` & co. = le FAIT qu'il y a un second propriétaire ;
--   - `est_indivision` = la QUALIFICATION, cochée quand on la connaît.
--
-- Ce que la case ne change PAS : une propriété à deux reste UNE propriété — une
-- part de charges, une voix, une période, une seule ligne. C'est vrai en
-- indivision comme en communauté, et c'est pourquoi le second propriétaire tient
-- toujours sur la même ligne (cf. 038).
--
-- `not null default false` : non cochée, la case dit « on ne l'affirme pas »,
-- pas « ce n'en est pas une ». Un booléen nullable aurait donné trois états pour
-- une information qu'on ne saisit qu'en la sachant.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbriqué, aucun
-- deux-points ni barre oblique dans une chaine, et une vérification SIMPLE.
-- =============================================================================

alter table proprietaires
  add column if not exists est_indivision boolean not null default false;

-- Les indivisions déjà connues du registre : elles viennent des libellés du
-- syndic préfixés « IND », repris en « Indivision … » à l'import. Là, la
-- qualification est établie par le syndic, on ne la devine pas.
update proprietaires
set est_indivision = true
where nom ilike 'Indivision%' and est_indivision = false;
