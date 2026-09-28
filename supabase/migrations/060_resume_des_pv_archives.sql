-- =============================================================================
-- Migration 060 — DOCUMENT DE RÉSUMÉ sur une archive de procès-verbal
--
-- Demande de Pascal (2026-09-28) : « créer un champ pour attacher un document de
-- résumé que Claude est en train de créer ».
--
-- =============================================================================
-- 1. POURQUOI UNE SECONDE PIÈCE, ET PAS LA MÊME
-- =============================================================================
-- ⚠ `document` porte le SCAN : c est la piece qui fait foi, et elle ne se
-- remplace pas. Le resume est un document DERIVE, redige apres coup, qui
-- explique ce que l assemblee a decide. Les deux n ont ni la meme autorite ni la
-- meme duree de vie : un resume se reecrit, un proces-verbal jamais.
--
-- Les mettre dans la meme colonne obligerait a distinguer lequel est lequel par
-- son nom de fichier — c est-a-dire a ne plus pouvoir le garantir. Une colonne
-- separee le dit structurellement.
--
-- ⚠ `resume` (text) EXISTE DEJA et reste : c est la synthese en quelques lignes,
-- saisie a la main, qui s affiche dans la liste. `resume_document` est le
-- FICHIER, forcement plus long, qu on ouvre quand on veut le detail. Les deux se
-- completent ; aucun ne remplace l autre.
--
-- =============================================================================
-- 2. MEME CONVENTION QUE LE RESTE
-- =============================================================================
-- {path,name,type,size} dans le bucket prive `documents`, sous le prefixe
-- `pv-archives/<annee>/`. On stocke un CHEMIN, jamais une URL : le bucket est
-- prive et l acces passe par une URL signee de courte duree.
--
-- ⚠ AUCUNE POLICY DE STORAGE A AJOUTER — verifie, pas suppose : le prefixe est
-- celui des scans, deja couvert. `documents_brouillon_prive` ne vise que le
-- prefixe `decisions`, et `documents_insert_membre` ouvre a tout membre actif.
--
-- ⚠ AUCUNE POLICY DE TABLE NON PLUS : `pv_archives` porte `read_auth` et
-- `pv_archives_bureau_write` (057), et la RLS restreint les LIGNES, pas les
-- colonnes.
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbrique, aucun
-- deux-points ni barre oblique dans une chaine, et une verification SIMPLE.
-- =============================================================================

alter table pv_archives
  add column if not exists resume_document jsonb;

comment on column pv_archives.resume_document is
  'Document de SYNTHESE redige apres coup, distinct du scan qui fait foi. {path,name,type,size} dans le bucket documents. Null tant qu aucun resume n a ete redige.';

-- ---------------------------------------------------------- vérification
-- La colonne existe, et les archives deja presentes ne sont pas touchees.
select
  (select count(*) from pv_archives)                                  as archives,
  (select count(*) from pv_archives where resume_document is not null) as avec_resume,
  (select count(*) from information_schema.columns
     where table_name = 'pv_archives' and column_name = 'resume_document') as colonne_posee;
