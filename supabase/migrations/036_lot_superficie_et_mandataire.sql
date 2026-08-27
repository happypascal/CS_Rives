-- =============================================================================
-- Migration 036 — SUPERFICIE des lots, et coordonnées du MANDATAIRE
--
-- Demande (Pascal, 2026-08-27) : « ajouter la superficie des lots dans le
-- registre des lots. Il sert à calculer les votes et les charges au prorata des
-- superficies. Il faut aussi ajouter email et tel pour le mandataire. »
--
-- -----------------------------------------------------------------------------
-- LA SUPERFICIE N'EST PAS UNE DONNÉE DESCRIPTIVE, C'EST UNE ASSIETTE
--
-- Elle porte deux choses qui engagent l'ASL :
--   - le POIDS DE VOTE en assemblée générale, les résolutions étant votées au
--     prorata des superficies (le détail des voix restant au PV) ;
--   - la RÉPARTITION DES CHARGES entre colotis.
-- Une superficie fausse ne produit donc pas un affichage faux : elle produit un
-- vote faux et un appel de fonds faux. C'est le champ le plus sensible du
-- registre après l'identité elle-même — d'où le `numeric(10,2)` plutôt qu'un
-- entier : les surfaces cadastrales ont des décimales, et arrondir déplacerait
-- des voix.
--
-- ⚠ Le TANTIÈME (part d'un lot dans le total) n'est PAS stocké : il se dérive de
-- la somme des superficies, exactement comme le budget d'un projet se dérive des
-- résolutions qui le financent. Le stocker créerait une divergence dès qu'un lot
-- serait ajouté, divisé ou corrigé — et personne ne remarquerait que les parts
-- ne font plus 100 %.
--
-- ⚠ `assemblees_generales.m2_presents` (migration 023) reste SAISI à la main :
-- c'est un constat de séance, pas un calcul. Le registre donnera bientôt le
-- dénominateur (total des superficies) pour le rapporter à un pourcentage, mais
-- il ne remplacera pas le relevé de présence.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase, incidents du 2026-08-25) : aucune
-- chaine vide, aucun argument de formatage de `raise`, aucun guillemet dollar
-- imbriqué, aucun deux-points dans une chaine, et une vérification SIMPLE.
-- =============================================================================

alter table lots
  add column if not exists superficie numeric(10,2);

-- Une superficie nulle ou négative n'existe pas ; une superficie ABSENTE, si —
-- le registre se remplira progressivement depuis les fichiers du syndic, et
-- bloquer la saisie d'un lot dont on n'a pas encore la surface serait absurde.
alter table lots drop constraint if exists lots_superficie_positive;
alter table lots add constraint lots_superficie_positive
  check (superficie is null or superficie > 0);

-- --------------------------------------------------------- mandataire (gérant)
-- Colonnes préfixées `gerant_` comme les trois existantes (`gerant_nom`,
-- `gerant_fonction`, `adresse_gerant`) : « gérant » et « mandataire » désignent
-- ici la même personne — celle qui représente le propriétaire quand ce n'est pas
-- lui qu'on doit joindre. Renommer l'ensemble pour suivre le second mot ne
-- gagnerait rien et casserait le code qui lit déjà les trois autres.
alter table proprietaires
  add column if not exists gerant_email text;
alter table proprietaires
  add column if not exists gerant_telephone text;

-- L'e-mail du mandataire est normalisé comme celui du propriétaire : c'est une
-- adresse de convocation, elle servira aux mêmes appariements. Le trigger ne
-- s'exécutait que sur `update of email` — il doit maintenant écouter les deux
-- colonnes, sans quoi une correction de l'adresse du mandataire passerait à côté.
create or replace function proprietaires_normalize_email()
returns trigger language plpgsql set search_path = public as $normalise_email_prop$
begin
  if new.email is not null then
    new.email := lower(btrim(new.email));
  end if;
  if new.gerant_email is not null then
    new.gerant_email := lower(btrim(new.gerant_email));
  end if;
  return new;
end $normalise_email_prop$;

drop trigger if exists trg_proprietaires_normalize_email on proprietaires;

create trigger trg_proprietaires_normalize_email
  before insert or update of email, gerant_email on proprietaires
  for each row execute function proprietaires_normalize_email();
