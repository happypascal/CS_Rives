-- =============================================================================
-- Migration 042 — « GÉRANT » DEVIENT « DIRIGEANT »
--
-- Correction de Pascal (2026-08-28) : « ce n'est pas gérant le bon terme, c'est
-- dirigeant de la SCI avec des fonctions ».
--
-- Elle est juste, et ce n'est pas de la cosmétique. **Gérant est une FONCTION,
-- pas une catégorie** : une SCI a des dirigeants, dont l'un peut être gérant,
-- un autre président, un autre associé. Nommer la colonne `gerant_nom` puis y
-- ranger un président, c'était écrire dans un registre légal que quelqu'un
-- occupe une fonction qu'il n'a pas — alors même que la colonne `fonction`
-- existe à côté pour dire laquelle.
--
-- D'où le renommage plutôt qu'un simple changement de libellé à l'écran : une
-- base qui dit « gérant » sous un écran qui dit « dirigeant » finit toujours par
-- ressortir dans un export, un CSV ou une requête d'appel de fonds.
--
-- ⚠ RENOMMAGE, PAS D'AJOUT : aucune donnée n'est copiée ni perdue, les valeurs
-- restent dans les mêmes lignes. `alter table ... rename column` est
-- transactionnel et instantané.
--
-- ⚠ FENÊTRE DE DÉSYNCHRONISATION, à connaître : le code déployé lit les tables
-- en `select *`, donc l'affichage continue de fonctionner immédiatement après
-- cette migration. En revanche un ENREGISTREMENT de propriétaire échouerait tant
-- que le code portant les nouveaux noms n'est pas déployé — d'où l'ordre
-- migration puis push, dans la foulée.
--
-- ⚠ Ne pas confondre avec le MANDATAIRE (037), qui n'est PAS renommé : le
-- dirigeant est un organe de la société et l'engage ; le mandataire ne fait que
-- relayer, et « mandataire » est bien la catégorie, pas une fonction.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbriqué, aucun
-- deux-points ni barre oblique dans une chaine, et une vérification SIMPLE.
-- =============================================================================

alter table proprietaires rename column gerant_nom          to dirigeant_nom;
alter table proprietaires rename column gerant_fonction     to dirigeant_fonction;
alter table proprietaires rename column gerant_email        to dirigeant_email;
alter table proprietaires rename column gerant_telephone    to dirigeant_telephone;
alter table proprietaires rename column adresse_gerant      to adresse_dirigeant;

alter table proprietaires rename column gerant_nom_2        to dirigeant_nom_2;
alter table proprietaires rename column gerant_fonction_2   to dirigeant_fonction_2;
alter table proprietaires rename column gerant_email_2      to dirigeant_email_2;
alter table proprietaires rename column gerant_telephone_2  to dirigeant_telephone_2;

-- Le trigger de normalisation nomme ses colonnes : il doit être réécrit, sans
-- quoi il référencerait des colonnes disparues et TOUTE écriture sur la table
-- échouerait. Les cinq adresses restent normalisées — une seule oubliée et son
-- adresse échappe à la canonisation, ce qui a déjà cassé un appariement
-- d'identité en production (migration 018).
create or replace function proprietaires_normalize_email()
returns trigger language plpgsql set search_path = public as $normalise_email_prop$
begin
  if new.email is not null then
    new.email := lower(btrim(new.email));
  end if;
  if new.email_2 is not null then
    new.email_2 := lower(btrim(new.email_2));
  end if;
  if new.dirigeant_email is not null then
    new.dirigeant_email := lower(btrim(new.dirigeant_email));
  end if;
  if new.dirigeant_email_2 is not null then
    new.dirigeant_email_2 := lower(btrim(new.dirigeant_email_2));
  end if;
  if new.mandataire_email is not null then
    new.mandataire_email := lower(btrim(new.mandataire_email));
  end if;
  return new;
end $normalise_email_prop$;

drop trigger if exists trg_proprietaires_normalize_email on proprietaires;

create trigger trg_proprietaires_normalize_email
  before insert or update of email, email_2, dirigeant_email, dirigeant_email_2, mandataire_email
  on proprietaires
  for each row execute function proprietaires_normalize_email();
