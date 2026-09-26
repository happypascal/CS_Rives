-- =============================================================================
-- Migration 059 — SUIVI DES TITRES DE PROPRIÉTÉ transmis au notaire
--
-- Demande de Pascal (2026-09-26). La résolution n° 15 de l assemblée 2026 impose
-- a chaque coloti d adresser son titre de propriete a Me Garnier avant le
-- 31 octobre, faute de quoi le notaire procede lui-meme a la recherche, facturee
-- 100 euros au proprietaire. Le registre doit donc savoir qui a transmis.
--
-- =============================================================================
-- 1. SUR LA PÉRIODE DE PROPRIÉTÉ, PAS SUR LE LOT
-- =============================================================================
-- ⚠ CE N EST PAS UN DÉTAIL DE RANGEMENT. Un titre de propriete appartient a
-- CELUI QUI L A RECU en achetant : il est attache a la personne et a sa periode,
-- pas a la parcelle. Pose sur `lots`, le drapeau survivrait a une mutation et le
-- nouveau proprietaire passerait pour avoir transmis un acte qui n est meme pas
-- le sien — alors que c est precisement de LUI que le notaire aurait besoin.
--
-- Sur `proprietaires`, une mutation ouvre une periode neuve, sans date : le
-- suivi repart a zero pour le nouvel arrivant, ce qui est exactement juste.
--
-- =============================================================================
-- 2. UNE DATE, PAS UNE CASE À COCHER
-- =============================================================================
-- ⚠ Une case dit « oui » ; une date dit « le 12 octobre ». Devant un delai
-- statutaire et une facturation a la cle, savoir QUAND un acte est arrive vaut
-- infiniment mieux que savoir qu il est arrive. Un booleen aurait aussi oblige a
-- inventer une seconde colonne le jour ou la date devient utile.
--
-- Null = pas transmis, ou pas encore su. ⚠ L application ne sait rien d elle
-- meme : c est le NOTAIRE qui recoit les actes et nous le dit. La colonne
-- enregistre ce qu il a communique, elle ne constate rien.
--
-- `acte_observations` reprend la seconde colonne libre de l export : « envoye
-- par courrier », « acte de donation, manque l acquisition d origine ». Ce que
-- le notaire ecrit a la main doit pouvoir etre recopie sans etre resume.
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbrique, aucun
-- deux-points ni barre oblique dans une chaine, et une verification SIMPLE.
-- =============================================================================

alter table proprietaires
  add column if not exists acte_transmis_le   date,
  add column if not exists acte_observations  text;

comment on column proprietaires.acte_transmis_le is
  'Date a laquelle le notaire a recu le titre de propriete de CE proprietaire. Null = pas transmis, ou pas encore su. Renseignee d apres ce que le notaire communique, jamais constatee par l application.';

comment on column proprietaires.acte_observations is
  'Ce que le notaire a note en face de cette ligne dans l etat des colotis qu il retourne.';

-- ⚠ Une date de transmission ANTERIEURE a l acquisition serait une faute de
-- saisie : on ne transmet pas le titre d un bien qu on ne possede pas encore.
-- La contrainte accepte les deux nulls, qui sont les cas normaux.
alter table proprietaires
  drop constraint if exists proprietaires_acte_apres_acquisition;

alter table proprietaires
  add constraint proprietaires_acte_apres_acquisition
  check (acte_transmis_le is null
         or date_acquisition is null
         or acte_transmis_le >= date_acquisition);

-- ⚠ AUCUNE POLICY À AJOUTER — verifie, pas suppose. `proprietaires` est ferme au
-- president et au secretaire par `proprietaires_bureau` (035), qui est un
-- `for all` : les nouvelles colonnes heritent de la meme fermeture. La RLS ne
-- restreint pas les colonnes, elle restreint les lignes.

-- ---------------------------------------------------------- vérification
-- Les colonnes existent, et aucune ligne n est en defaut.
select
  (select count(*) from proprietaires)                                    as periodes,
  (select count(*) from proprietaires where date_cession is null)         as proprietaires_actuels,
  (select count(*) from proprietaires where acte_transmis_le is not null) as actes_transmis;
