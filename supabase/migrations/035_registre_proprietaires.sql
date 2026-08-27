-- =============================================================================
-- Migration 035 — REGISTRE DES MEMBRES DE L'ASL (propriétaires et lots)
--
-- Demande (Pascal, 2026-08-27). Un registre des propriétaires, réservé au
-- PRÉSIDENT et au SECRÉTAIRE, avec l'historique des anciens propriétaires et
-- les dates de mutation.
--
-- ⚠ DONNÉES PERSONNELLES. C'est la première table de l'application qui en
-- contient massivement : noms, adresses privées, e-mails, téléphones de
-- personnes qui ne sont pas membres du CS. Deux conséquences portées ici :
--   - ces tables ne sont PAS ajoutées à la boucle `read_auth` (« tout membre
--     connecté lit tout ») — ce serait ouvrir le fichier à tout le conseil ;
--   - l'accès est fermé par des policies dédiées `is_admin() or is_secretaire()`,
--     en lecture COMME en écriture.
-- Ne pas relâcher cette règle sans arbitrage : un trésorier ou un membre
-- ordinaire n'a pas à disposer du fichier des propriétaires.
--
-- -----------------------------------------------------------------------------
-- MODÈLE — LE LOT est la chose stable, le propriétaire est une PÉRIODE
--
-- Un lot ne bouge pas ; ses propriétaires se succèdent. D'où deux tables plutôt
-- qu'une :
--   - `lots`          : numéro et adresse dans le lotissement ;
--   - `proprietaires` : une ligne par PÉRIODE de propriété d'un lot.
--
-- Le propriétaire ACTUEL est celui dont `date_cession` est nulle. L'historique,
-- ce sont les autres. Une MUTATION consiste donc à clore la période en cours
-- (date_cession) et à en ouvrir une nouvelle (date_acquisition) : les deux dates
-- portent la mutation, il n'y a pas de table `mutations` à tenir en plus.
--
-- L'index partiel garantit qu'un lot n'a JAMAIS deux propriétaires actuels —
-- l'erreur qu'une saisie de mutation mal terminée produirait immanquablement.
--
-- -----------------------------------------------------------------------------
-- LIEN AVEC LE CHANTIER COLOTIS (gelé, cf. docs/SPEC_ONBOARDING_COLOTIS.md)
--
-- Ce registre EST le rôle des colotis dont l'onboarding avait besoin. Il est
-- donc conçu pour pouvoir servir d'ancre d'identité plus tard — d'où l'e-mail
-- normalisé comme dans `membres_cs`. ⚠ Mais RIEN ici n'ouvre l'application aux
-- propriétaires : aucun compte, aucune lecture élargie. Le chantier reste gelé.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase, incidents du 2026-08-25) : aucune
-- chaine vide, aucun argument de formatage de `raise`, aucun guillemet dollar
-- imbriqué, aucun deux-points dans une chaine.
-- =============================================================================

-- --------------------------------------------------------------------- lots
create table if not exists lots (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,   -- « 12 », « 12A » : texte, un lot n'est pas toujours un entier
  adresse_lotissement text,                   -- adresse dans le lotissement
  observations        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ------------------------------------------------------------- proprietaires
-- Une ligne = une PÉRIODE de propriété. `date_cession is null` = propriétaire
-- actuel ; les autres lignes sont l'historique.
create table if not exists proprietaires (
  id                    uuid primary key default gen_random_uuid(),
  lot_id                uuid not null references lots(id) on delete cascade,

  -- Identité. `nom` porte le nom de la personne OU la raison sociale de la SCI.
  -- `est_societe` évite d'avoir à deviner à partir du nom du gérant.
  nom                   text not null,
  est_societe           boolean not null default false,
  gerant_nom            text,
  gerant_fonction       text,                 -- gérant, président, associé…

  -- Adresses. Celle du lotissement vit sur le LOT (elle ne change pas avec le
  -- propriétaire) ; ici on garde celles qui suivent la personne.
  adresse_communication text,                 -- adresse officielle de communication
  adresse_gerant        text,

  email                 text,
  telephone             text,

  -- La période, donc la mutation.
  date_acquisition      date,
  date_cession          date,                 -- nulle = propriétaire ACTUEL

  observations          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Une cession ne peut pas précéder l'acquisition.
  constraint proprietaires_periode_coherente
    check (date_cession is null or date_acquisition is null or date_cession >= date_acquisition)
);

-- UN SEUL propriétaire actuel par lot. Index partiel : les lignes historiques
-- (date_cession renseignée) n'y participent pas, donc autant d'anciens
-- propriétaires qu'on veut. Sans lui, une mutation mal terminée laisserait deux
-- propriétaires en cours et le registre deviendrait faux en silence.
create unique index if not exists proprietaires_actuel_par_lot
  on proprietaires (lot_id) where date_cession is null;

create index if not exists proprietaires_lot_idx on proprietaires (lot_id, date_acquisition desc);

-- E-mail canonique, comme `membres_cs` (migration 018) : la casse a déjà cassé
-- l'appariement d'identité une fois en production. Ce registre étant destiné à
-- servir d'ancre d'identité aux colotis, on ne refait pas l'erreur.
create or replace function proprietaires_normalize_email()
returns trigger language plpgsql set search_path = public as $normalise_email_prop$
begin
  if new.email is not null then
    new.email := lower(btrim(new.email));
  end if;
  return new;
end $normalise_email_prop$;

drop trigger if exists trg_proprietaires_normalize_email on proprietaires;
create trigger trg_proprietaires_normalize_email
  before insert or update of email on proprietaires
  for each row execute function proprietaires_normalize_email();

-- ------------------------------------------- acceptation de la mention RGPD
-- Portée par le membre : c'est un fait le concernant, et il n'a à l'accepter
-- qu'une fois. Horodatée pour pouvoir dire QUAND elle a été acceptée — une
-- mention d'information dont on ne peut pas prouver la date ne vaut pas grand
-- chose.
alter table membres_cs
  add column if not exists registre_rgpd_accepte_le timestamptz;

-- Trace de l'acceptation dans le journal d'audit.
create or replace function membres_audit_rgpd()
returns trigger language plpgsql security definer set search_path = public as $audit_rgpd$
begin
  if new.registre_rgpd_accepte_le is not null
     and old.registre_rgpd_accepte_le is null then
    insert into audit_log (entite, entite_id, action, acteur, details)
      values ('membres_cs', new.id, 'rgpd',
              current_membre_id(),
              concat('Mention RGPD du registre des propriétaires acceptée par ', new.prenom, ' ', new.nom));
  end if;
  return null;
end $audit_rgpd$;

drop trigger if exists trg_membres_audit_rgpd on membres_cs;
create trigger trg_membres_audit_rgpd
  after update on membres_cs
  for each row execute function membres_audit_rgpd();

-- =============================================================================
-- Row Level Security — PRÉSIDENT ET SECRÉTAIRE UNIQUEMENT
--
-- ⚠ Ces deux tables ne figurent PAS dans la boucle `read_auth` du schéma : il
-- n'y a donc AUCUNE lecture par défaut. Un membre ordinaire, un trésorier, ne
-- voient rien — pas même le nombre de lots. C'est l'inverse du reste de
-- l'application, et c'est délibéré : ce sont des données personnelles de tiers.
-- =============================================================================
alter table lots          enable row level security;
alter table proprietaires enable row level security;

drop policy if exists "lots_bureau" on lots;
create policy "lots_bureau" on lots for all to authenticated
  using (is_admin() or is_secretaire())
  with check (is_admin() or is_secretaire());

drop policy if exists "proprietaires_bureau" on proprietaires;
create policy "proprietaires_bureau" on proprietaires for all to authenticated
  using (is_admin() or is_secretaire())
  with check (is_admin() or is_secretaire());
