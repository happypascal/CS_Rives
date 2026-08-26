-- =============================================================================
-- Migration 033 — trace du RATTACHEMENT d'une décision enregistrée à un projet
--
-- Problème signalé par Pascal (2026-08-26) : « on ne peut pas rattacher une
-- décision une fois qu'elle est approuvée. Ça ne va pas car si on crée le projet
-- après avoir approuvé, il faut quand même pouvoir la rattacher. »
--
-- Le cas est courant et légitime : le CS vote l'attribution d'un marché, la
-- décision est enregistrée, et le projet qui va porter le chantier n'est ouvert
-- qu'ensuite. La décision doit pouvoir le rejoindre.
--
-- -----------------------------------------------------------------------------
-- CE QUI EST FIGÉ, ET CE QUI NE L'EST PAS
--
-- L'enregistrement fige la DÉLIBÉRATION : le texte, les votes, la composition du
-- conseil, le montant engagé. Le `projet_id`, lui, est un CLASSEMENT — sous
-- quel chantier la décision est rangée. Ce n'est pas ce que le conseil a voté.
--
-- Rien n'était d'ailleurs verrouillé en base : `write_admin` autorise déjà le
-- président à écrire sur une décision enregistrée, et le trigger de gel
-- (`decisions_cycle_guard`) ne protège que `titre` et `description`. Le blocage
-- était **uniquement dans l'écran**, qui refuse d'ouvrir le formulaire d'une
-- décision enregistrée — et il doit continuer de le refuser. D'où un chemin
-- DÉDIÉ, qui ne touche que le rattachement, plutôt qu'un déverrouillage général.
--
-- ⚠ Ce chemin ne modifie QUE `projet_id`. En particulier `resolution_id` et
-- `ag_id` ne sont PAS effacés, contrairement à ce que fait le formulaire de
-- création : sur une délibération figée on ne détruit rien, et la résolution
-- sous laquelle la décision a été votée fait partie de son histoire. Sans effet
-- sur les budgets — `computeAGBudgets` ne compte en engagement direct que les
-- décisions SANS projet, il n'y a donc pas de double compte.
--
-- Cette migration n'ajoute donc aucune colonne : elle ajoute la TRACE. Modifier
-- une ligne du registre légal sans laisser d'empreinte serait le vrai problème.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase, incidents du 2026-08-25) : aucune
-- chaine vide, aucun argument de formatage de `raise`, aucun guillemet dollar
-- imbriqué, aucun deux-points dans une chaine.
-- =============================================================================

create or replace function decisions_audit_rattachement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_avant text;
  v_apres text;
begin
  -- Seulement sur une décision ENREGISTRÉE : avant l'acte, un changement de
  -- rattachement est une saisie ordinaire, elle n'a pas à encombrer le journal.
  if new.enregistree and new.projet_id is distinct from old.projet_id then
    select p.nom into v_avant from projets p where p.id = old.projet_id;
    select p.nom into v_apres from projets p where p.id = new.projet_id;
    insert into audit_log (entite, entite_id, action, acteur, details)
      values (
        'decisions',
        new.id,
        'rattachement',
        current_membre_id(),
        concat('Décision ', new.numero, ' — rattachement ',
               coalesce(v_avant, 'aucun projet'), ' vers ', coalesce(v_apres, 'aucun projet'))
      );
  end if;
  return null;
end $$;

drop trigger if exists trg_decisions_audit_rattachement on decisions;

create trigger trg_decisions_audit_rattachement
  after update on decisions
  for each row execute function decisions_audit_rattachement();
