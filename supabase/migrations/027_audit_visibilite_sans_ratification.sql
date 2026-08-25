-- =============================================================================
-- Migration 027 — trace d'audit du changement de visibilité,
--                 et RETRAIT de la ratification en réunion
--
-- ⚠ RAPPEL DE FORME, appris à la dure avec la 026 (2026-08-25, cinq rejets) :
-- l'éditeur SQL de Supabase a un analyseur maison qui refuse le script AVANT
-- Postgres sur trois constructions pourtant valides. À bannir ici et dans toute
-- migration future :
--   - toute chaine vide, qu'il prend pour une apostrophe échappée (y compris
--     dans un commentaire) ;
--   - tout argument de formatage de `raise` (les `%`, `to_char(...)`) ;
--   - un guillemet dollar imbriqué dans un autre.
-- Et : un objet par exécution, en commençant par le plus petit.
-- =============================================================================

-- --------------------------------------------------------------------------
-- 1. RETRAIT de `ratifiee_en_reunion_le` (arbitrage Pascal 2026-08-25)
--
-- La colonne a été ajoutée par la 026 sur la foi du §4 de la spec : l'art. 15
-- étant rédigé pour des RÉUNIONS, un vote asynchrone dans l'app est une
-- consultation écrite que les statuts ne prévoient pas expressément, et la spec
-- proposait d'inscrire la réunion qui la ratifie.
--
-- Elle repart parce qu'elle contredit la raison d'être de l'application :
-- « le but de cette app est de ne PAS avoir à ratifier ces décisions en
-- réunion ». Organiser la ratification dans l'outil, c'était installer la
-- pratique qu'il existe pour éviter.
--
-- ⚠ La QUESTION DE FOND reste entière, et l'absence de champ ne la règle pas :
-- savoir si l'art. 15 couvre la consultation écrite se tranche avec Me Garnier,
-- pas dans le schéma. Si la réponse impose une ratification, c'est cette
-- migration qu'il faudra défaire — pas une raison de garder un champ mort en
-- attendant. Aucune donnée perdue : la colonne n'a jamais été renseignée
-- (posée puis retirée le 25/08).
alter table decisions drop column if exists ratifiee_en_reunion_le;

-- --------------------------------------------------------------------------
-- 2. Trace d'audit du changement de VISIBILITÉ
--
-- Un TRIGGER, et pas un insert côté application, pour deux raisons :
--   - il attrape TOUS les chemins — la carte du président sur une décision
--     enregistrée comme le formulaire du rédacteur sur un brouillon — là où un
--     insert dans `changerVisibilite` aurait raté le second ;
--   - `audit_log` n'est écrivable que par `write_admin` : un insert côté client
--     aurait échoué pour un rédacteur non président, donc silencieusement perdu
--     la trace, ou pire fait échouer son enregistrement. `security definer`
--     règle les deux.
--
-- C'est le premier écrit dans `audit_log` côté Supabase : jusqu'ici seul le mode
-- démo l'alimentait, et le journal restait vide en production.
--
-- Portée volontairement étroite : la seule visibilité. Auditer toute la table
-- serait un autre chantier (volume, colonnes sensibles, rétention) — à ouvrir
-- pour de bon, pas en passant.
create or replace function decisions_audit_visibilite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.visibilite is distinct from old.visibilite then
    insert into audit_log (entite, entite_id, action, acteur, details)
      values (
        'decisions',
        new.id,
        'visibilite',
        current_membre_id(),
        concat('Décision ', new.numero, ' — visibilité ', old.visibilite, ' vers ', new.visibilite)
      );
  end if;
  return null;
end $$;

drop trigger if exists trg_decisions_audit_visibilite on decisions;

create trigger trg_decisions_audit_visibilite
  after update on decisions
  for each row execute function decisions_audit_visibilite();
