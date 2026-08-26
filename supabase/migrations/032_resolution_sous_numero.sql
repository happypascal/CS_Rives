-- =============================================================================
-- Migration 032 — SOUS-NUMÉROTATION des résolutions (10-1 / 10-2 / 10-3)
--
-- Le problème, signalé par Pascal (2026-08-26), est un problème de MODÈLE, pas
-- de confort : « j'ai une résolution dans le PV qui concerne la revalidation du
-- budget de 3 projets, mais j'en ai fait 3 résolutions dans l'app pour pouvoir
-- ventiler les budgets dans les projets ».
--
-- C'est une conséquence directe d'une règle structurelle : `resolutions_ag`
-- porte UN `projet_id`, donc une enveloppe ne finance qu'un projet, et elle y
-- passe EN ENTIER (indivisible). Ventiler un budget voté sur trois projets
-- impose donc trois lignes — alors que le procès-verbal, lui, n'en connaît
-- qu'une, la n° 10.
--
-- Sans sous-numérotation, il fallait inventer trois numéros (10, 11, 12) qui ne
-- correspondent à rien dans le PV, ou trois fois le même — refusé par l'unicité.
-- Faire mentir le registre sur la numérotation d'un PV n'est pas acceptable.
--
-- -----------------------------------------------------------------------------
-- POURQUOI DEUX ENTIERS, ET PAS UN NUMÉRO EN TEXTE
--
-- Passer `numero` en `text` pour y écrire « 10-1 » aurait cassé le TRI : en
-- ordre lexicographique, « 10-1 » se range avant « 2 ». Il aurait fallu une clé
-- de tri séparée — donc deux colonnes de toute façon, avec en prime un format
-- libre impossible à valider.
--
-- Deux entiers gardent le tri trivial (`order by numero, sous_numero`),
-- l'unicité vérifiable par la base, et la saisie contrainte. L'affichage
-- « 10-1 » est reconstruit à la lecture (`numeroResolution`, agLogic.js).
--
-- `sous_numero = 0` signifie PAS DE SOUS-NUMÉROTATION — le cas normal, et donc
-- le défaut. Un entier plutôt que NULL pour deux raisons : l'unicité
-- `(ag_id, numero, sous_numero)` fonctionne sans dépendre de `nulls not
-- distinct` (disponible seulement depuis PostgreSQL 15), et le tri n'a pas à
-- traiter de cas nul.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase, incidents du 2026-08-25) : aucune
-- chaine vide, aucun argument de formatage de `raise`, aucun guillemet dollar
-- imbriqué, aucun deux-points dans une chaine.
-- =============================================================================

alter table resolutions_ag
  add column if not exists sous_numero integer not null default 0;

-- L'unicité porte désormais sur le couple. L'ancienne contrainte, déclarée en
-- ligne dans le `create table`, porte le nom automatique de Postgres.
alter table resolutions_ag drop constraint if exists resolutions_ag_ag_id_numero_key;

alter table resolutions_ag drop constraint if exists resolutions_ag_ag_id_numero_sous_numero_key;
alter table resolutions_ag add constraint resolutions_ag_ag_id_numero_sous_numero_key
  unique (ag_id, numero, sous_numero);

-- Rien à reprendre sur l'existant : toutes les résolutions déjà en base sont des
-- résolutions simples, et le défaut 0 les décrit exactement.
