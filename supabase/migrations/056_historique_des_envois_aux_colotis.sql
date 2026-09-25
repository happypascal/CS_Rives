-- =============================================================================
-- Migration 056 — HISTORIQUE DES ENVOIS AUX COLOTIS
--
-- Spécification de Pascal du 2026-09-25 (lot A). Les messages collectifs aux
-- colotis partent par un AppleScript depuis Mail, sur un Mac. Il n en restait
-- de trace que dans un journal local, ECRASE A CHAQUE CAMPAGNE. Or convoquer,
-- relancer, informer sont des actes de gestion : qui a ete destinataire, quel
-- texte exact, a quelle date. Le registre doit les conserver.
--
-- =============================================================================
-- 1. DEUX TABLES, PARCE QUE DEUX NATURES DE DONNEES
-- =============================================================================
-- `communications`             = LA CAMPAGNE : date, objet, texte envoye, bilan.
-- `communication_destinataires` = LES PERSONNES : 55 noms et 55 adresses.
--
-- ⚠ CE N EST PAS UN DECOUPAGE TECHNIQUE, C EST UN DECOUPAGE DE DROIT D ACCES.
-- Voir le point 3 : la campagne se lit par tous, la liste des destinataires non.
-- Les fondre en une seule table jsonb aurait rendu ce partage impossible.
--
-- =============================================================================
-- 2. RIEN QUI SOIT PROPRE A MAIL
-- =============================================================================
-- La phase 2 fera partir les messages depuis l application elle-meme. Le schema
-- doit donc survivre a la bascule : `canal` dit par ou c est parti
-- (`applescript_mail` aujourd hui, `app` demain) et c est la SEULE colonne qui
-- connaisse l outil. Aucun identifiant de message Mail, aucun chemin de boite,
-- aucune notion de compte AppleScript.
--
-- `source_fichier` garde le chemin du journal importe : ce n est pas un detail
-- d outil, c est la PIECE dont l historique est tire. Un enregistrement dont on
-- ne peut plus dire d ou il vient ne vaut pas grand chose dans un registre.
--
-- =============================================================================
-- 3. RLS — LA CAMPAGNE POUR TOUS, LES ADRESSES POUR LE BUREAU
-- =============================================================================
-- ⚠ LA SPECIFICATION SE CONTREDIT SUR CE POINT, et il fallait trancher. Elle
-- demande d un cote « lecture pour tout membre authentifie » en s alignant sur
-- `sujet_entrees`, et de l autre « meme regime que proprietaires » au titre du
-- RGPD. Or ces deux regimes sont OPPOSES : `sujet_entrees` se lit par tous,
-- `proprietaires` est ferme au president et au secretaire depuis la 035.
--
-- Tranche par la NATURE de la donnee, et les deux phrases sont honorees :
--   - `communications` suit `sujet_entrees` : un acte de gestion du conseil, que
--     tout membre doit pouvoir consulter. Le texte envoye aux colotis n a rien
--     de confidentiel, il a ete envoye a cinquante-cinq personnes.
--   - `communication_destinataires` suit `proprietaires` : president et
--     secretaire uniquement. Ce sont les memes adresses que la 035 a fermees.
--     Les rouvrir ici serait les faire fuir par la porte de derriere, exactement
--     ce que la regle « l historique suit la visibilite de sa decision » evite
--     ailleurs.
--
-- ⚠ Consequence assumee : un tresorier voit qu une campagne est partie, avec
-- son texte et le NOMBRE de destinataires, mais pas a qui. C est le bon partage
-- — il peut verifier qu une information a ete diffusee sans consulter un
-- fichier d adresses.
--
-- ECRITURE : president ou secretaire. Le secretaire est celui qui convoque et
-- ecrit aux colotis ; c est deja lui qui tient le registre des proprietaires
-- d ou sortent les adresses.
--
-- =============================================================================
-- 4. CE QUI EST VOLONTAIREMENT ABSENT
-- =============================================================================
-- Aucun accuse de reception, aucun statut « lu ». Mail ne le sait pas, et une
-- colonne qui ne peut pas etre remplie fidelement ment par omission. `statut`
-- vaut `envoye` ou `erreur` : c est ce que le journal constate, rien de plus.
--
-- Aucune modification depuis l application non plus, hors `commentaire` : ce
-- sont des FAITS deja survenus, pas des brouillons. Corriger le texte d un
-- message deja parti reecrirait l histoire.
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbrique, aucun
-- deux-points ni barre oblique dans une chaine, et une verification SIMPLE.
-- =============================================================================

-- ----------------------------------------------------------- la campagne
create table if not exists communications (
  id               uuid primary key default gen_random_uuid(),
  date_envoi       timestamptz not null,
  objet            text not null,
  corps_fr         text not null,
  corps_en         text,
  canal            text not null default 'applescript_mail',
  mode_test        boolean not null default false,
  expediteur       text,
  nb_destinataires integer not null default 0,
  nb_envoyes       integer not null default 0,
  nb_erreurs       integer not null default 0,
  source_fichier   text,
  commentaire      text,
  cree_par         uuid references membres_cs(id),
  created_at       timestamptz not null default now(),
  unique (date_envoi, objet)
);

-- ⚠ Le canal est contraint : demain `app`, et rien d autre sans y avoir pense.
alter table communications
  drop constraint if exists communications_canal_check;

alter table communications
  add constraint communications_canal_check
  check (canal in ('applescript_mail','app'));

comment on table communications is
  'Une campagne de message collectif aux colotis. Acte de gestion, lu par tous les membres. Les destinataires sont dans communication_destinataires, ferme au bureau.';

comment on column communications.canal is
  'Par ou le message est parti. Seule colonne qui connaisse l outil, pour que la phase 2 (envoi depuis l application) n impose aucune migration.';

comment on column communications.source_fichier is
  'Chemin du journal importe. C est la piece dont l historique est tire.';

-- ------------------------------------------------------- les destinataires
create table if not exists communication_destinataires (
  id               uuid primary key default gen_random_uuid(),
  communication_id uuid not null references communications(id) on delete cascade,
  nom              text,
  email            text not null,
  langue           text,
  statut           text not null,
  message_erreur   text,
  proprietaire_id  uuid references proprietaires(id),
  rang             integer,
  created_at       timestamptz not null default now(),
  unique (communication_id, email)
);

alter table communication_destinataires
  drop constraint if exists communication_destinataires_statut_check;

alter table communication_destinataires
  add constraint communication_destinataires_statut_check
  check (statut in ('envoye','erreur'));

-- ⚠ `proprietaire_id` est NULLABLE, et ce n est pas une facilite. Une adresse
-- qui ne correspond a aucun proprietaire du registre est soit un contact perime,
-- soit quelqu un qui n est pas coloti. Les deux cas doivent etre VISIBLES, pas
-- resolus par une ligne inventee. On ne cree jamais de proprietaire a cette
-- occasion.
comment on column communication_destinataires.proprietaire_id is
  'Rapprochement avec le registre, par adresse. Null quand aucune correspondance : c est un signalement, pas un defaut de saisie.';

comment on column communication_destinataires.rang is
  'Le i de [i sur N] dans le journal. Conserve l ordre reel de l envoi.';

create index if not exists communication_destinataires_comm_idx
  on communication_destinataires (communication_id);

create index if not exists communications_date_idx
  on communications (date_envoi desc);

-- =============================================================================
-- RLS
-- =============================================================================
alter table communications              enable row level security;
alter table communication_destinataires enable row level security;

-- La campagne : lue par tout membre authentifie, comme la memoire du lotissement.
drop policy if exists "read_auth" on communications;
create policy "read_auth" on communications
  for select to authenticated using (true);

drop policy if exists "communications_bureau_write" on communications;
create policy "communications_bureau_write" on communications
  for all to authenticated
  using (is_admin() or is_secretaire())
  with check (is_admin() or is_secretaire());

-- ⚠ Les destinataires : AUCUNE policy de lecture ouverte. Meme regime que
-- `lots` et `proprietaires` (035) — president et secretaire, lecture comme
-- ecriture. Une seule policy `for all` suffit et evite qu une lecture ouverte
-- soit ajoutee par distraction a cote d une ecriture fermee.
drop policy if exists "communication_destinataires_bureau" on communication_destinataires;
create policy "communication_destinataires_bureau" on communication_destinataires
  for all to authenticated
  using (is_admin() or is_secretaire())
  with check (is_admin() or is_secretaire());

-- ---------------------------------------------------------- vérification
-- Les deux tables existent, elles sont vides, et la RLS est active sur les deux.
select
  (select count(*) from communications)                          as campagnes,
  (select count(*) from communication_destinataires)              as destinataires,
  (select count(*) from pg_policies
     where tablename = 'communications')                          as policies_campagnes,
  (select count(*) from pg_policies
     where tablename = 'communication_destinataires')             as policies_destinataires;
