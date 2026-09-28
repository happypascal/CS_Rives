-- =============================================================================
-- Migration 061 — L ANNÉE D UNE AG EST CELLE DE SON EXERCICE, pas de sa séance
--
-- Trois corrections demandées par Pascal (2026-09-28), dont une qui invalide une
-- contrainte posée par la 057.
--
-- =============================================================================
-- 1. LA CONTRAINTE DE COHÉRENCE ÉTAIT FONDÉE SUR UNE ERREUR DE MA PART
-- =============================================================================
-- ⚠ La 057 posait `pv_archives_annee_coherente` : une date de séance devait
-- tomber dans l annee de classement. Je l avais justifiee ainsi — « une date
-- complete qui ne tombe pas dans son annee rangerait le document a un endroit
-- et l afficherait a un autre ». C etait supposer que `annee` designe l annee de
-- la SEANCE.
--
-- Elle ne la designe pas. Pascal : « AGO du 19/1/26 est l AGO 2025 ». L annee
-- d une assemblee generale est celle de l EXERCICE sur lequel elle statue —
-- comptes, budget, quitus — et une assemblee tenue en janvier porte sur l annee
-- ecoulee. C est d ailleurs pour cela que le fichier etait range dans le dossier
-- 2025 : le classement du lotissement etait juste, c est ma contrainte qui etait
-- fausse.
--
-- ⚠ La contrainte est donc SUPPRIMEE, et rien ne la remplace. Une regle qui
-- interdit un cas legitime ne se remplace pas par une regle plus fine : elle
-- disparait. Le decalage entre seance et exercice est NORMAL, il n a pas a etre
-- signale.
--
-- =============================================================================
-- 2. LE DOCUMENT DE SYNTHESE EST UNIQUE, PAS UN PAR ASSEMBLEE
-- =============================================================================
-- ⚠ `resume_document` a ete ajoutee par la 060, il y a une heure, sur une
-- lecture erronee de la demande. Pascal : « le document de synthese est en
-- en-tete de la LISTE des AG ». Il y en a UN pour tout le fonds, pas un par
-- proces-verbal.
--
-- Elle est donc retiree plutot que laissee vide : « une colonne morte finit
-- toujours par etre reprise » (migration 004), et une colonne de document sur
-- chaque ligne inviterait a y deposer des synthèses individuelles qui feraient
-- double emploi avec `resume`.
--
-- Le document unique vit dans `parametres` (cle `pv_archives_synthese`), comme
-- les coordonnees du gestionnaire : une valeur unique, qui change rarement, et
-- qui n a pas de table a elle. Aucune DDL n est necessaire pour cela.
--
-- =============================================================================
-- 3. CE QUI NE CHANGE PAS
-- =============================================================================
-- `resume` (text) reste, et devient l element principal de chaque fiche : le
-- resume des decisions de CETTE assemblee, en tete. Il n a jamais fait double
-- emploi avec un fichier — l un se lit d un coup d oeil, l autre s ouvre.
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbrique, aucun
-- deux-points ni barre oblique dans une chaine, et une verification SIMPLE.
-- =============================================================================

alter table pv_archives
  drop constraint if exists pv_archives_annee_coherente;

alter table pv_archives
  drop column if exists resume_document;

comment on column pv_archives.annee is
  'Annee de l EXERCICE sur lequel l assemblee statue, pas celle de la seance. Une AG tenue en janvier porte sur l annee ecoulee.';

comment on column pv_archives.resume is
  'Resume des decisions principales de cette assemblee. Affiche en tete de la fiche.';

-- ---------------------------------------------------------- vérification
-- La contrainte est levee, la colonne est partie, et les 27 archives sont
-- intactes.
select
  (select count(*) from pv_archives)                                     as archives,
  (select count(*) from pg_constraint
     where conname = 'pv_archives_annee_coherente')                      as contrainte_restante,
  (select count(*) from information_schema.columns
     where table_name = 'pv_archives' and column_name = 'resume_document') as colonne_restante;
