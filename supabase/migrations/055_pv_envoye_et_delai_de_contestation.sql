-- =============================================================================
-- Migration 055 — STATUT « PV ENVOYÉ », date d'envoi officielle, et clôture
--                 de plein droit à l'expiration du délai de contestation
--
-- Demande de Pascal (2026-09-18) : « il manque un statut à une AG : le statut
-- PV envoyé, avec la date d'envoi officielle, avant la clôture automatique s'il
-- n'y a pas eu de contestation dans les 12 mois après la date d'envoi. »
--
-- =============================================================================
-- 1. CE QUI MANQUAIT AU CYCLE
-- =============================================================================
-- Le cycle s'arrêtait à : preparation → convoquee → (tenue, dérivé) → cloturee,
-- la clôture étant un ACTE MANUEL du président qui fige l'assemblée.
--
-- Il manquait le fait juridique qui court entre les deux : l'ENVOI DU
-- PROCÈS-VERBAL. C'est lui qui fait courir le délai de contestation, et c'est sa
-- DATE qui compte — pas celle de la séance, pas celle de la rédaction. Une
-- assemblée dont le PV a été envoyé n'est ni « tenue » (c'est fini) ni
-- « clôturée » (le délai court encore) : elle est dans un état propre, qui a une
-- durée et une échéance.
--
-- =============================================================================
-- 2. LA CLÔTURE DEVIENT DÉRIVÉE, ET N'EST PAS ÉCRITE
-- =============================================================================
-- ⚠ AUCUN pg_cron, AUCUN trigger, AUCUNE écriture automatique de `statut`.
-- L'assemblée est réputée close quand `date_envoi_pv` + le délai est passée et
-- qu'aucune contestation n'est inscrite. Le calcul se fait À LA LECTURE, comme
-- « AG a eu lieu » depuis la migration 023.
--
-- Trois raisons de préférer la dérivation à l'écriture :
--   - une date d'envoi corrigée doit corriger la clôture ; une clôture écrite
--     resterait, et le registre affirmerait une date de clôture fausse ;
--   - une contestation inscrite APRÈS coup doit rouvrir l'assemblée ; un statut
--     écrit aurait figé l'inverse ;
--   - rien ne s'écrit dans un registre légal sans que quelqu'un l'ait décidé.
--     Ici personne ne décide : c'est le temps qui passe, et le temps n'a pas à
--     laisser de trace d'écriture.
--
-- ⚠ CONSÉQUENCE ASSUMÉE : l'AG se FIGE toute seule le jour dit (plus de
-- modification des résolutions). C'est le but — passé le délai, le
-- procès-verbal est définitif.
--
-- =============================================================================
-- 3. LA CONTESTATION EST UN FAIT, DONC ELLE S'INSCRIT
-- =============================================================================
-- « S'il n'y a pas eu de contestation » suppose de pouvoir dire qu'il y en a eu
-- une. `contestation_le` (quand) et `contestation_objet` (quoi) : sans elles, la
-- condition ne serait pas vérifiable et la clôture tomberait quand même.
--
-- Une contestation inscrite SUSPEND la clôture de plein droit — indéfiniment.
-- Elle ne clôt rien et ne rejette rien : l'issue d'une contestation est une
-- affaire de droit, pas d'application. Le président garde son bouton pour
-- clôturer à la main quand l'affaire est vidée.
--
-- =============================================================================
-- 4. LE DÉLAI EST UN PARAMÈTRE, PAS UNE CONSTANTE
-- =============================================================================
-- ⚠ DOUZE MOIS EST LA VALEUR DONNÉE PAR PASCAL, pas une règle que j'ai lue. Les
-- statuts sont en cours de révision (AG du 15 septembre 2026, rédaction finale
-- par Me Garnier) et ce délai est exactement le genre de chiffre qu'ils peuvent
-- fixer autrement. Le coder en dur obligerait à une migration pour un nombre.
-- Il rejoint `parametres` (migration 054), à côté du total des m².
--
-- ⚠ Et comme le total des m², il ne doit pas RÉTROAGIR : l'échéance affichée est
-- recalculée à la lecture, donc changer le délai déplacerait les échéances des
-- assemblées en cours. C'est voulu ici, contrairement au taux de participation :
-- un délai de contestation est une règle de droit en vigueur, pas un constat de
-- séance. Si les statuts le changent, il change pour toutes les AG dont le délai
-- court encore — et pas pour celles déjà closes, qui ont leur statut écrit.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbriqué, aucun
-- deux-points ni barre oblique dans une chaine, et une vérification SIMPLE.
-- =============================================================================

-- ------------------------------------------- nouveau statut dans la contrainte
alter table assemblees_generales
  drop constraint if exists assemblees_generales_statut_check;

alter table assemblees_generales
  add constraint assemblees_generales_statut_check
  check (statut in ('preparation','convoquee','pv_envoye','cloturee','annulee'));

-- ------------------------------------------------- dates de l'envoi et du litige
alter table assemblees_generales
  add column if not exists date_envoi_pv      date,
  add column if not exists contestation_le    date,
  add column if not exists contestation_objet text;

comment on column assemblees_generales.date_envoi_pv is
  'Date d ENVOI OFFICIEL du proces-verbal. C est elle qui fait courir le delai de contestation, pas la date de seance.';

comment on column assemblees_generales.contestation_le is
  'Date d une contestation inscrite. Sa presence SUSPEND la cloture de plein droit, indefiniment. L application ne juge pas la contestation.';

-- ⚠ Une date d'envoi est indispensable au statut « PV envoyé » : sans elle, le
-- délai ne court pas et la clôture de plein droit ne pourrait jamais être
-- calculée. On refuse l'état incohérent plutôt que de le laisser s'installer.
alter table assemblees_generales
  drop constraint if exists ag_pv_envoye_exige_une_date;

alter table assemblees_generales
  add constraint ag_pv_envoye_exige_une_date
  check (statut <> 'pv_envoye' or date_envoi_pv is not null);

-- ------------------------------------------------------- délai, en paramètre
insert into parametres (cle, valeur)
values ('delai_contestation_mois', '12')
on conflict (cle) do nothing;

-- ---------------------------------------------------------- vérification
-- Le paramètre existe, la contrainte accepte le nouveau statut, et aucune AG
-- n'est dans un état incoherent.
select
  (select valeur from parametres where cle = 'delai_contestation_mois')     as delai_mois,
  (select count(*) from assemblees_generales)                               as ag_total,
  (select count(*) from assemblees_generales where statut = 'pv_envoye')    as ag_pv_envoye,
  (select count(*) from assemblees_generales
     where statut = 'pv_envoye' and date_envoi_pv is null)                  as ag_incoherentes;
