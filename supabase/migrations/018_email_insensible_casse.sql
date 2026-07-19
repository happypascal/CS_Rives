-- =============================================================================
-- Migration 018 — appariement email membre ⇄ Auth INSENSIBLE À LA CASSE
--
-- Incident prod (2026-07-19) : un membre (Marc) lisait et téléchargeait, mais ne
-- pouvait NI voter NI publier en Q/R. Cause : `membres_cs.email = 'Marc@…'`
-- (majuscule) alors qu'Auth renvoie `'marc@…'`. Les helpers RLS comparent
-- l'email au STRICT (`=`) → `current_membre_id()` renvoyait `null` → toute
-- écriture liée à l'identité (vote, Q/R) rejetée par la RLS. Les LECTURES
-- passaient : elles n'exigent aucune identité (policy `read_auth`), d'où le
-- symptôme trompeur « il voit tout mais ne peut rien faire ».
--
-- Le correctif du jour — `update membres_cs set email = lower(...)` — a soigné le
-- symptôme, pas la cause : le PROCHAIN membre saisi avec une majuscule casserait
-- pareil. Cette migration ferme la cause à DEUX niveaux :
--
--   1. Les 4 helpers `security definer` comparent en `lower()` — la casse n'entre
--      plus jamais en jeu, y compris pour les lignes héritées.
--   2. Un trigger normalise `membres_cs.email` (lower + trim) à l'écriture — la
--      base est TOUJOURS canonique, quel que soit le client (app, SQL direct,
--      restore, import).
--
-- Pourquoi les DEUX et pas seulement le trigger : le trigger protège les
-- écritures futures ; le `lower()` des helpers protège AUSSI toute donnée qu'un
-- chemin détourné aurait insérée sans passer par le trigger. La RLS ne fait pas
-- confiance à la propreté de la table.
--
-- Rappel : `auth.users.email` est déjà stocké en minuscules par Supabase ; c'est
-- le côté `membres_cs` qui dérivait (saisie manuelle dans Membres). On normalise
-- donc `membres_cs`, et on compare quand même les deux côtés en `lower()` par
-- sûreté.
-- =============================================================================

-- 1. Normaliser l'existant (idempotent — sûr à rejouer).
update membres_cs set email = lower(trim(email))
where email is not null and email <> lower(trim(email));

-- 2. Helpers RLS : comparaison insensible à la casse.
--    (Balises nommées $secretaire$/$tresorier$ conservées : l'éditeur Supabase
--    parse mal deux fonctions $$ qui se suivent — cf. migration 014.)
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $is_admin$
  select exists (
    select 1 from membres_cs m
    where lower(m.email) = lower(auth.jwt() ->> 'email') and m.role = 'president' and m.actif
  );
$is_admin$;

create or replace function is_secretaire()
returns boolean language sql stable security definer set search_path = public as $secretaire$
  select exists (select 1 from membres_cs m where lower(m.email) = lower(auth.jwt() ->> 'email') and m.role = 'secretaire' and m.actif);
$secretaire$;

create or replace function is_tresorier()
returns boolean language sql stable security definer set search_path = public as $tresorier$
  select exists (select 1 from membres_cs m where lower(m.email) = lower(auth.jwt() ->> 'email') and m.role = 'tresorier' and m.actif);
$tresorier$;

create or replace function current_membre_id()
returns uuid language sql stable security definer set search_path = public as $current_membre$
  select m.id from membres_cs m where lower(m.email) = lower(auth.jwt() ->> 'email') limit 1;
$current_membre$;

-- 3. Trigger : `membres_cs.email` TOUJOURS canonique (lower + trim) à l'écriture.
--    Ceinture + bretelles avec la normalisation applicative
--    (`createMembre`/`updateMembre` côté supabaseDb.js) : la base garantit
--    l'invariant même si un jour une écriture contourne l'app.
create or replace function membres_cs_normalize_email()
returns trigger language plpgsql set search_path = public as $normalize_email$
begin
  if new.email is not null then
    new.email := lower(trim(new.email));
  end if;
  return new;
end;
$normalize_email$;

drop trigger if exists trg_membres_cs_normalize_email on membres_cs;
create trigger trg_membres_cs_normalize_email
  before insert or update of email on membres_cs
  for each row execute function membres_cs_normalize_email();
