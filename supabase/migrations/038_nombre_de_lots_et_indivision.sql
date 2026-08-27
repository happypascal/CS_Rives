-- =============================================================================
-- Migration 038 — NOMBRE DE LOTS par parcelle, et INDIVISION à deux propriétaires
--
-- Deux demandes de Pascal (2026-08-27), traitées ensemble parce qu'elles portent
-- toutes deux sur « une ligne du registre ne vaut pas une unité ».
--
-- -----------------------------------------------------------------------------
-- 1. `lots.nombre_lots` — UNE PARCELLE N'EST PAS UN LOT
--
-- Le registre compte 50 parcelles mais **51 lots** : deux parcelles pèsent 1,81
-- et 1,19 lot. Compter les lignes annonçait donc « 50 lots », un chiffre faux
-- dans un registre qui sert d'assiette aux voix et aux charges.
--
-- Arbitrage de Pascal : plutôt que de taire le total, porter le nombre de lots
-- SUR chaque parcelle, à 1 par défaut. Le registre redevient capable de compter
-- juste, et les deux exceptions cessent d'être une note en observations que
-- personne n'additionne.
--
-- `not null default 1` : à la création d'une parcelle, 1 est le cas réel dans
-- 48 cas sur 50 — laisser la colonne nullable produirait des totaux qui varient
-- selon que quelqu'un a pensé à remplir le champ.
-- `numeric(4,2)` : 1,81 et 1,19 ne sont pas des entiers, et arrondir déplacerait
-- une fraction de lot.
--
-- -----------------------------------------------------------------------------
-- 2. INDIVISION — deux personnes, mais UNE SEULE propriété
--
-- Une indivision, c'est une part de charges, une voix au prorata d'une seule
-- superficie, une seule période de propriété. En faire deux LIGNES de
-- `proprietaires` produirait exactement les faux dont ce registre doit protéger :
--   - l'index partiel `proprietaires_actuel_par_lot` l'interdit — et il a raison,
--     il existe pour qu'un lot n'ait jamais deux propriétaires actuels ;
--   - tout décompte par propriétaire compterait la parcelle deux fois, donc la
--     superficie deux fois, donc les voix et les charges deux fois.
-- D'où un second jeu de coordonnées SUR la même ligne : la période reste une,
-- elle est simplement détenue par deux personnes.
--
-- ⚠ Limite ASSUMÉE : deux indivisaires nommés, pas trois. Le registre de l'ASL
-- n'en connaît pas au-delà aujourd'hui, et une table d'indivisaires pour un cas
-- qui n'existe pas serait payée à chaque lecture. Un troisième se note en
-- observations en attendant une vraie table.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbriqué, aucun
-- deux-points ni barre oblique dans une chaine, et une vérification SIMPLE.
-- =============================================================================

alter table lots
  add column if not exists nombre_lots numeric(4,2) not null default 1;

alter table lots drop constraint if exists lots_nombre_lots_positif;
alter table lots add constraint lots_nombre_lots_positif
  check (nombre_lots > 0);

-- Les deux exceptions connues du lotissement, reprises du fichier de l'ASL. Sur
-- une installation neuve ces parcelles n'existent pas et l'update ne fait rien.
update lots set nombre_lots = 1.81 where numero = '0B 247+263';
update lots set nombre_lots = 1.19 where numero = '0B 474';

-- ------------------------------------------------------------------ indivision
alter table proprietaires
  add column if not exists nom_2 text;
alter table proprietaires
  add column if not exists email_2 text;
alter table proprietaires
  add column if not exists telephone_2 text;

-- Quatrième adresse normalisée. Le trigger doit écouter TOUTES les colonnes
-- d'e-mail : une seule oubliée et son adresse échappe à la canonisation, ce qui
-- a déjà cassé un appariement d'identité en production (migration 018).
create or replace function proprietaires_normalize_email()
returns trigger language plpgsql set search_path = public as $normalise_email_prop$
begin
  if new.email is not null then
    new.email := lower(btrim(new.email));
  end if;
  if new.email_2 is not null then
    new.email_2 := lower(btrim(new.email_2));
  end if;
  if new.gerant_email is not null then
    new.gerant_email := lower(btrim(new.gerant_email));
  end if;
  if new.mandataire_email is not null then
    new.mandataire_email := lower(btrim(new.mandataire_email));
  end if;
  return new;
end $normalise_email_prop$;

drop trigger if exists trg_proprietaires_normalize_email on proprietaires;

create trigger trg_proprietaires_normalize_email
  before insert or update of email, email_2, gerant_email, mandataire_email on proprietaires
  for each row execute function proprietaires_normalize_email();
