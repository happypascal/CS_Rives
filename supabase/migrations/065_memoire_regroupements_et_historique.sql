-- =============================================================================
-- Migration 065 — MÉMOIRE DE L ASL : regroupements, détachements, historique
--
-- Pascal (2026-09-30) : les syntheses sont trop minces ou absentes, et plusieurs
-- entrees sont fausses — 2008 « adoptee a l unanimite », un « Pour : 72 854 »,
-- une « resolution 10-2 » qui n existe pas. Les entrees venues des archives sont
-- eclatees en sous-resolutions (10.1 a 10.6) aux titres illisibles.
--
-- ⚠ LA REGLE QUI COMMANDE TOUTE LA MIGRATION : ON NE SUPPRIME RIEN. Aucune des
-- quatre colonnes ajoutees ici n efface quoi que ce soit ; elles ne font que
-- changer ce qui s AFFICHE et garder la trace de ce qui a ete remplace.
--
-- =============================================================================
-- 1. `regroupee_sous` — SIX SOUS-RESOLUTIONS SOUS UNE SEULE LIGNE
-- =============================================================================
-- La resolution 10 de l AG 2023 vit en six entrees (« Portails : principe »,
-- « … choix de l entreprise », « … mandat », « … honoraires », « … appel de
-- fonds », « … mobilisation du fonds ») dont cinq s intitulent « Portails ».
-- Lues a plat dans une chronologie, elles disent six fois la meme chose et
-- cachent le fil.
--
-- ⚠ L ENTREE CONSOLIDEE EST UNE ENTREE COMME UNE AUTRE : elle a sa date, son
-- titre, son texte. Les entrees regroupees POINTENT vers elle et cessent de
-- s afficher a plat — elles restent lisibles, repliees dessous. Aucune ligne ne
-- disparait, et l on peut toujours remonter a la sous-resolution exacte.
--
-- ⚠ `on delete set null` et non `cascade` : supprimer une entree consolidee ne
-- doit JAMAIS emporter les six qu elle resume. Elles redeviendraient visibles a
-- plat, ce qui est exactement le bon repli.
--
-- =============================================================================
-- 2. `detachee_le` / `detachee_motif` — RETIRER SANS SUPPRIMER
-- =============================================================================
-- Trois entrees sont rattachees au mauvais sujet : un miroir de securite
-- routiere range dans « Plage », par exemple. Il faut les retirer de la
-- chronologie du sujet SANS les effacer.
--
-- ⚠ POURQUOI PAS `sujet_id` NULLABLE. Une entree sans sujet n apparaitrait nulle
-- part : elle serait perdue en pratique tout en existant en base — le pire des
-- deux mondes. Elle garde donc son rattachement, et le detachement est un FAIT
-- DATE ET MOTIVE, que l ecran peut montrer a qui veut le verifier.
--
-- =============================================================================
-- 3. `resultat` / `vote` — CE QUE L ASSEMBLEE A DECIDE
-- =============================================================================
-- La memoire portait le resultat noye dans le texte (« Resolution 9, adoptee a
-- l unanimite — mais ce qui est adopte… »). Le sortir en colonne permet de le
-- corriger sans reecrire une phrase, et de le COLORER : « Decision sans vote
-- formel » en bleu, comme dans les archives.
--
-- ⚠ `vote` EST REDIGE et porte parfois DEUX scrutins (« Principe : Pour 2 081 ·
-- Contre 1 119 — mandat : Pour 2 381 · Contre 819 ») : aucune somme n y a de
-- sens, et il n est jamais recalcule.
--
-- =============================================================================
-- 4. `sujets.historique` — CE QU ON REMPLACE NE DOIT PAS DISPARAITRE
-- =============================================================================
-- ⚠ Les syntheses et les resumes sont REECRITS par cette revision. Une memoire
-- qui perd ses versions anterieures ne peut plus repondre a « qui a ecrit cela,
-- et quand ? » — precisement la question qu elle existe pour tenir.
--
-- Forme : [{ le, resume, contenu, motif }], la plus recente en tete.
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbrique, aucun
-- deux-points ni barre oblique dans une chaine, et une verification SIMPLE.
-- =============================================================================

alter table sujet_entrees
  add column if not exists resultat        text,
  add column if not exists vote            text,
  add column if not exists regroupee_sous  uuid references sujet_entrees(id) on delete set null,
  add column if not exists detachee_le     timestamptz,
  add column if not exists detachee_motif  text;

alter table sujets
  add column if not exists historique jsonb not null default '[]'::jsonb;

create index if not exists sujet_entrees_regroupee_idx on sujet_entrees (regroupee_sous);

comment on column sujet_entrees.regroupee_sous is
  'Entree consolidee qui resume celle-ci. ⚠ Les entrees regroupees ne s affichent plus a plat dans la chronologie, elles sont repliees sous leur consolidee — aucune n est supprimee. `on delete set null` : supprimer la consolidee rend les six visibles a plat, jamais ne les emporte.';

comment on column sujet_entrees.detachee_le is
  'Date a laquelle l entree a ete retiree de la chronologie du sujet. ⚠ Elle GARDE son `sujet_id` : une entree sans sujet n apparaitrait nulle part et serait perdue en pratique tout en existant en base.';

comment on column sujet_entrees.vote is
  'Le vote, REDIGE. Porte parfois deux scrutins (principe et mandat) : aucune somme n y a de sens, et il n est jamais recalcule depuis les archives.';

comment on column sujets.historique is
  'Les versions anterieures du resume et de la synthese : [{ le, resume, contenu, motif }], la plus recente en tete. ⚠ Une memoire qui perd ses versions ne peut plus dire qui a ecrit quoi, et quand.';

-- ---------------------------------------------------------- vérification
-- Les colonnes existent et rien n a bouge.
select
  (select count(*) from sujets)                                      as sujets,
  (select count(*) from sujet_entrees)                               as entrees,
  (select count(*) from information_schema.columns
     where table_name = 'sujet_entrees'
       and column_name in ('resultat','vote','regroupee_sous','detachee_le','detachee_motif')) as colonnes_entrees,
  (select count(*) from information_schema.columns
     where table_name = 'sujets' and column_name = 'historique')     as colonne_historique;
