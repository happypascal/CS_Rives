-- =============================================================================
-- Migration 023 — cycle de statut d'AG révisé
--
-- Ancien : en_cours / cloturee / annulee.
-- Nouveau (stocké) : preparation / convoquee / cloturee / annulee.
--
-- Cycle : « En préparation » → « Convocations envoyées » (manuel) → « AG a eu lieu »
-- (AUTOMATIQUE, dérivé quand date_ag est passée — JAMAIS stocké) → « Clôturée ».
-- L'heure de fin de séance n'est saisissable qu'au stade « a eu lieu », et la
-- clôture (fige l'AG) ne s'ouvre qu'à ce moment (gardes côté application).
-- =============================================================================

alter table assemblees_generales drop constraint assemblees_generales_statut_check;

-- Migrer l'existant : 'en_cours' → 'preparation'. Les AG déjà passées seront
-- affichées « AG a eu lieu » par dérivation (date), sans changer le stocké.
update assemblees_generales set statut = 'preparation' where statut = 'en_cours';

alter table assemblees_generales add constraint assemblees_generales_statut_check
  check (statut in ('preparation','convoquee','cloturee','annulee'));

alter table assemblees_generales alter column statut set default 'preparation';

-- Données A POSTERIORI, saisies une fois l'AG tenue (avant clôture) :
--   - quorum_statut : résultat de quorum de la séance.
--   - m2_presents   : total des m² présents ou représentés (le vote est au prorata
--                     des superficies ; le détail des voix reste au PV).
alter table assemblees_generales add column if not exists quorum_statut text
  check (quorum_statut in ('quorum_atteint','sans_quorum_accepte','sans_quorum_rejete'));
alter table assemblees_generales add column if not exists m2_presents numeric(10,2);
