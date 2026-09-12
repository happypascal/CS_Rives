-- =============================================================================
-- Migration 051 — HISTORIQUE DES MANDATS du Conseil Syndical
--
-- Demande de Pascal (2026-09-11) : « pour les membres du conseil syndical, il
-- serait bien de pouvoir avoir un historique de toutes les élections (même si
-- c'est une AG ancienne qui n'est pas dans l'app) et leur rôle s'il a changé. »
--
-- CE QUE LA BASE SAVAIT, ET CE QU'ELLE OUBLIAIT. `membres_cs` porte UN mandat,
-- à plat : `role`, `date_election`, `date_fin`, `ag_election`. Une réélection
-- ÉCRASE l'élection précédente, une désignation au bureau écrase le rôle tenu
-- avant. Le registre ne pouvait donc pas répondre à « qui siégeait en 2019 ? »
-- ni à « depuis quand est-il trésorier ? » — alors que c'est exactement ce
-- qu'un registre légal doit établir, l'art. 15 confiant les délibérations à des
-- membres dont la qualité doit pouvoir être prouvée à la date des faits.
--
-- ⚠ L'ÉCHÉANCE REND LA PERTE IMMINENTE. L'AG du 15 septembre 2026 renouvelle le
-- conseil. Sans cette table, saisir les nouveaux élus le 16 septembre effacerait
-- définitivement la mandature élue le 19 juin 2025 — il n'en resterait qu'une
-- trace indirecte dans les `composition_snapshot` des délibérations enregistrées.
--
-- MÊME PATRON QUE LE REGISTRE DES PROPRIÉTAIRES (migrations 035 et 038), qui a
-- déjà tranché cette forme de question : « le LOT est stable, le propriétaire
-- est une PÉRIODE ». Ici le MEMBRE est stable, le MANDAT est une période. D'où
-- une ligne par période, avec sa date de début, sa date de fin et le rôle tenu
-- PENDANT cette période — et non un champ de plus sur `membres_cs`.
--
-- ⚠ POURQUOI `membres_cs` GARDE SES COLONNES DE MANDAT. Elles ne font pas
-- double emploi : elles sont l'état OPÉRANT, celui dont dépendent deux
-- mécanismes qu'on ne touche pas à quatre jours d'une AG —
--   1. `is_admin()`, `is_tresorier()`, `is_secretaire()` lisent `membres_cs.role` :
--      c'est la sécurité de toute l'application ;
--   2. `activeMembersAt` (JS) lit `date_election` / `date_fin` pour établir la
--      COMPOSITION DU CS APPELÉE À VOTER et le DÉNOMINATEUR DU QUORUM.
-- Déplacer ces lectures vers l'historique changerait le calcul du quorum. On ne
-- réécrit pas la règle de quorum dans la migration qui ajoute un historique.
-- `mandats_cs` RACONTE, `membres_cs` OPÈRE. Écart assumé, écrit ici pour qu'on
-- ne le redécouvre pas comme un bug.
--
-- ⚠ POURQUOI L'HISTORIQUE EST SAISI ET NON DÉDUIT PAR UN TRIGGER. Un trigger sur
-- `membres_cs` qui ouvrirait un mandat à chaque changement de `role` ou de
-- `date_election` a été écrit puis ÉCARTÉ : il ne sait pas distinguer une
-- RÉÉLECTION d'une CORRECTION DE SAISIE. Corriger une faute de frappe dans une
-- date d'élection aurait fabriqué une élection qui n'a jamais eu lieu, et un
-- registre légal ne peut pas inventer une élection. L'écran pose donc la
-- question à celui qui sait — « nouveau mandat » ou « correction » — et c'est
-- la seule réponse honnête.
--
-- ⚠ `ag_id` EST NULLABLE, ET C'EST LE CŒUR DE LA DEMANDE. Les AG antérieures à
-- l'application n'y figurent pas et n'y figureront jamais. `ag_libelle` recueille
-- alors le texte de la convocation ou du PV (« AGO du 12 juin 2018 »), tel qu'il
-- se lit sur la pièce. On ne crée pas une AG fictive pour satisfaire une clé
-- étrangère : ce serait inscrire au registre une assemblée que l'app n'a pas
-- tenue. Même raisonnement qu'au président de séance, jamais obligatoire à la
-- convocation parce qu'il est désigné EN séance.
--
-- ⚠ `origine` DISTINGUE L'ÉLECTION DE LA DÉSIGNATION, et ce n'est pas une
-- nuance de vocabulaire. L'art. 14 partage les deux actes : l'AG ÉLIT les
-- membres du conseil, le président DÉSIGNE parmi eux un trésorier et un
-- secrétaire. Ranger une désignation de bureau sous « élue par l'AG »
-- attribuerait à l'assemblée un acte qu'elle n'a pas fait. Trois valeurs
-- seulement, et aucune inventée au-delà de ce que les statuts nomment.
--
-- ⚠ UN SEUL MANDAT EN COURS PAR MEMBRE — index partiel, exactement le rôle que
-- joue `proprietaires_actuel_par_lot` sur le registre des propriétaires. Les
-- rôles sont exclusifs (on n'est pas trésorier ET secrétaire) ; sans cet index,
-- une réélection mal terminée laisserait deux mandats ouverts et le registre
-- dirait deux rôles à la fois, en silence.
--
-- ⚠ `membres_cs.email` DEVIENT NULLABLE. Pour inscrire l'élection de 2018, il
-- faut pouvoir inscrire ceux qui siégeaient alors — dont certains ont quitté le
-- conseil avant que l'application existe et n'auront jamais de compte. `not
-- null` obligeait à INVENTER une adresse : une donnée fausse dans un registre
-- légal, et un risque réel de collision avec l'adresse d'un tiers, l'appariement
-- membre-compte se faisant justement par l'e-mail. Aucun effet sur la sécurité :
-- les helpers comparent `lower(m.email) = lower(jwt email)`, et une adresse nulle
-- ne matche jamais — un ancien membre sans adresse ne peut donc rien ouvrir.
-- L'écran continue d'exiger l'adresse pour un membre ACTIF, qui doit se connecter.
--
-- LECTURE OUVERTE À TOUT MEMBRE (boucle `read_auth`), écriture au président
-- seul (`write_admin`). Ce n'est pas le registre des propriétaires : la
-- composition du conseil n'est pas une donnée personnelle de tiers, elle figure
-- déjà au registre des délibérations, dans les PV d'AG et au bas des PDF signés.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbriqué, aucun
-- deux-points ni barre oblique dans une chaine, et une vérification SIMPLE.
-- =============================================================================

-- --------------------------------------------------------------- la table
create table if not exists mandats_cs (
  id          uuid primary key default gen_random_uuid(),
  membre_id   uuid not null references membres_cs(id) on delete cascade,
  -- Le rôle TENU PENDANT CETTE PÉRIODE. Même liste que `membres_cs.role` : deux
  -- vocabulaires de rôles finiraient par diverger.
  role        text not null default 'membre'
              check (role in ('president','tresorier','secretaire','membre')),
  -- Comment la période a commencé (art. 14) : l'AG élit, le président désigne
  -- le bureau. `cooptation` couvre le remplacement en cours de mandature.
  origine     text not null default 'election'
              check (origine in ('election','designation','cooptation')),
  date_debut  date not null,
  -- Nulle = mandat EN COURS. C'est la définition, comme `date_cession is null`
  -- désigne le propriétaire actuel d'un lot.
  date_fin    date,
  -- L'AG de l'app quand elle y est ; sinon le libellé de la pièce, saisi tel
  -- qu'il s'y lit. Les deux peuvent coexister — et AUCUNE CONTRAINTE n'en exige
  -- un : les membres déjà en base n'ont pas tous d'`ag_election`, et refuser la
  -- reprise de leur mandat pour cette raison perdrait précisément ce qu'on vient
  -- sauver. L'écran, lui, réclame la référence à la saisie.
  ag_id       uuid references assemblees_generales(id) on delete set null,
  ag_libelle  text,
  observations text,
  created_at  timestamptz not null default now(),
  constraint mandats_cs_periode_coherente
    check (date_fin is null or date_fin >= date_debut)
);

comment on table mandats_cs is
  'Historique des mandats du CS. Le membre est stable, le mandat est une periode. membres_cs porte l etat operant (role, quorum), cette table raconte l enchainement.';

-- Un seul mandat ouvert par membre. Sans cet index, une reelection mal terminee
-- laisserait deux periodes ouvertes et le registre dirait deux roles a la fois.
create unique index if not exists mandats_cs_en_cours_par_membre
  on mandats_cs (membre_id) where date_fin is null;

create index if not exists mandats_cs_membre_idx
  on mandats_cs (membre_id, date_debut desc);

-- --------------------------------------------------- e-mail facultatif (historique)
-- Voir l'en-tête : inscrire l'élection de 2018 suppose d'inscrire ceux qui
-- siégeaient alors, dont certains n'auront jamais de compte.
alter table membres_cs alter column email drop not null;

-- ------------------------------------------------------------------- RLS
alter table mandats_cs enable row level security;

drop policy if exists "read_auth" on mandats_cs;
create policy "read_auth" on mandats_cs for select to authenticated using (true);

-- ⚠ Nommée `write_admin`, comme dans les boucles de `schema.sql` : une install
-- neuve et une base migrée doivent porter les MÊMES noms de policy, sinon le
-- jour où l'une refuse une écriture, la comparaison des deux ne dit rien.
drop policy if exists "write_admin" on mandats_cs;
create policy "write_admin" on mandats_cs
  for all to authenticated using (is_admin()) with check (is_admin());

-- ----------------------------------------------- reprise de l'existant
-- Chaque membre déjà en base a UN mandat, celui que portent ses colonnes. On le
-- verse tel quel : sans cette reprise, l'historique naîtrait vide et la
-- mandature en cours n'y figurerait pas.
--
-- ⚠ `ag_id` reste NUL même quand une AG de l'app porte la même date. Rapprocher
-- « AGO 19 juin 2025 » d'une ligne d'`assemblees_generales` par le texte serait
-- une DEVINETTE, et le registre ne devine pas. Le président relie lui-même
-- depuis l'écran, où il voit les deux.
insert into mandats_cs (membre_id, role, origine, date_debut, date_fin, ag_libelle)
select m.id, m.role, 'election', m.date_election, m.date_fin, m.ag_election
from membres_cs m
where not exists (select 1 from mandats_cs x where x.membre_id = m.id);

-- ---------------------------------------------------------- vérification
-- Doit afficher autant de mandats que de membres, et zéro membre sans mandat.
select
  (select count(*) from membres_cs)                              as membres,
  (select count(*) from mandats_cs)                              as mandats,
  (select count(*) from membres_cs m
     where not exists (select 1 from mandats_cs x where x.membre_id = m.id)) as membres_sans_mandat;
