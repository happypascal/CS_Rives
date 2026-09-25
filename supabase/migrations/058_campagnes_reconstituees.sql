-- =============================================================================
-- Migration 058 — CAMPAGNES RECONSTITUÉES : dire ce qu on sait, et comment
--
-- Addendum a la specification A (2026-09-25). Le journal d envoi est ecrase a
-- chaque campagne : les trois campagnes anterieures au 25 septembre ne sont pas
-- reconstituables depuis lui. Elles ont ete retrouvees dans le dossier du
-- lotissement et rassemblees sous `_campagnes/`, une par dossier.
--
-- =============================================================================
-- 1. TOUTES LES CAMPAGNES NE SE VALENT PAS, ET LE REGISTRE DOIT LE DIRE
-- =============================================================================
-- ⚠ C EST TOUT L OBJET DE CETTE MIGRATION. Une campagne du 25 septembre est
-- adossee a un journal qui nomme chaque destinataire et son sort. Une campagne
-- du 1er septembre est adossee a l horodatage d un fichier texte et a une liste
-- dont on ne peut pas DEMONTRER qu elle est celle qui a servi.
--
-- Les inscrire de la meme maniere ferait du registre un menteur poli : tout y
-- aurait l air egalement certain. Deux colonnes portent donc la nuance :
--
--   `communications.fiabilite`        journal | reconstitue
--   `communication_destinataires.statut`  + la valeur `suppose_envoye`
--
-- ⚠ `suppose_envoye` n est PAS un `envoye` degrade : il dit que la personne
-- FIGURAIT SUR LA LISTE, pas qu un envoi vers elle a ete constate. La
-- difference compte le jour ou quelqu un affirme n avoir rien recu.
--
-- =============================================================================
-- 2. UN TROISIEME CANAL
-- =============================================================================
-- La campagne du 18 aout n est pas partie par le script mais directement depuis
-- Mail, en copie cachee. `mail_bcc` rejoint donc `applescript_mail` et `app`.
-- Ce n est pas un detail d outil : c est ce qui explique pourquoi cette
-- campagne-la n a pas de journal, et pourquoi ses destinataires se lisent dans
-- l en-tete du message conserve.
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbrique, aucun
-- deux-points ni barre oblique dans une chaine, et une verification SIMPLE.
-- =============================================================================

-- --------------------------------------------------------------- fiabilite
-- `default 'journal'` : la seule campagne deja inscrite (25 septembre) l est a
-- partir de son journal complet. Le defaut dit donc vrai pour l existant, et
-- l import pose explicitement `reconstitue` sur les autres.
alter table communications
  add column if not exists fiabilite text not null default 'journal';

alter table communications
  drop constraint if exists communications_fiabilite_check;

alter table communications
  add constraint communications_fiabilite_check
  check (fiabilite in ('journal','reconstitue'));

comment on column communications.fiabilite is
  'journal = adossee a un journal d envoi qui nomme chaque destinataire et son sort. reconstitue = retrouvee apres coup, date et liste etablies par recoupement.';

-- ------------------------------------------------------- nouveau canal
alter table communications
  drop constraint if exists communications_canal_check;

alter table communications
  add constraint communications_canal_check
  check (canal in ('applescript_mail','mail_bcc','app'));

-- --------------------------------------------------- statut suppose_envoye
alter table communication_destinataires
  drop constraint if exists communication_destinataires_statut_check;

alter table communication_destinataires
  add constraint communication_destinataires_statut_check
  check (statut in ('envoye','erreur','suppose_envoye'));

comment on column communication_destinataires.statut is
  'envoye et erreur sont CONSTATES par un journal. suppose_envoye dit seulement que la personne figurait sur la liste de l envoi : aucun envoi vers elle n a ete constate.';

-- ---------------------------------------------------------- vérification
-- La campagne deja inscrite garde sa fiabilite journal, et les contraintes
-- acceptent les nouvelles valeurs.
select
  (select count(*) from communications)                                   as campagnes,
  (select count(*) from communications where fiabilite = 'journal')       as journalisees,
  (select count(*) from communications where fiabilite = 'reconstitue')   as reconstituees,
  (select count(*) from communication_destinataires)                      as destinataires;
