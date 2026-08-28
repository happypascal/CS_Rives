-- =============================================================================
-- Migration 041 — SECOND GÉRANT (co-gérance des SCI)
--
-- Demande de Pascal (2026-08-28) : « les SCI ont souvent plusieurs dirigeants
-- mais on ne note que le gérant. On pourrait avoir 2 gérants sur 2 colonnes. »
--
-- La co-gérance est le cas ordinaire d'une SCI familiale, et elle a des effets
-- concrets pour l'ASL : deux personnes peuvent engager la société, donc voter
-- pour elle et signer pour elle. N'en nommer qu'une laissait le registre muet
-- sur celle qui se présenterait à l'assemblée.
--
-- Suffixe `_2`, comme `nom_2` / `email_2` / `telephone_2` de la 038 : dans cette
-- table, `_2` désigne déjà « la seconde personne du même rôle ».
--
-- ⚠ PAS de seconde adresse : `adresse_gerant` reste unique, c'est en pratique
-- celle du siège. Deux co-gérants d'une même SCI se joignent à la même adresse
-- postale, et ajouter une colonne pour un cas jamais rencontré se paierait à
-- chaque lecture.
--
-- ⚠ Limite ASSUMÉE, la même que pour les indivisaires : DEUX gérants nommés, pas
-- trois. Un troisième se note en observations en attendant une vraie table.
--
-- ⚠ Ne pas confondre avec le MANDATAIRE (migration 037) : le gérant est un
-- organe de la société et l'engage ; le mandataire ne fait que relayer. Un
-- second gérant reste un dirigeant, pas un intermédiaire.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbriqué, aucun
-- deux-points ni barre oblique dans une chaine, et une vérification SIMPLE.
-- =============================================================================

alter table proprietaires
  add column if not exists gerant_nom_2 text;
alter table proprietaires
  add column if not exists gerant_fonction_2 text;
alter table proprietaires
  add column if not exists gerant_email_2 text;
alter table proprietaires
  add column if not exists gerant_telephone_2 text;

-- Cinquième adresse normalisée. Le trigger doit écouter TOUTES les colonnes
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
  if new.gerant_email_2 is not null then
    new.gerant_email_2 := lower(btrim(new.gerant_email_2));
  end if;
  if new.mandataire_email is not null then
    new.mandataire_email := lower(btrim(new.mandataire_email));
  end if;
  return new;
end $normalise_email_prop$;

drop trigger if exists trg_proprietaires_normalize_email on proprietaires;

create trigger trg_proprietaires_normalize_email
  before insert or update of email, email_2, gerant_email, gerant_email_2, mandataire_email
  on proprietaires
  for each row execute function proprietaires_normalize_email();
