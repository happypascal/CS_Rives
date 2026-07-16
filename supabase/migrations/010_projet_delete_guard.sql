-- =============================================================================
-- Migration 010 — un projet portant une décision enregistrée n'est plus supprimable
--
-- Règle (arbitrage Pascal 2026-07-16) : dès qu'on a engagé de l'argent sur un
-- projet, on ne peut plus l'effacer. La garde porte sur les décisions
-- ENREGISTRÉES, ce qui couvre exactement la règle — l'argent engagé vient
-- forcément d'une décision enregistrée et adoptée — et ferme au passage une
-- atteinte au verrou d'enregistrement.
--
-- Le trou : `decisions.projet_id` est en `on delete set null`. Supprimer le projet
-- remettait donc `projet_id` à null sur SES décisions, y compris les enregistrées.
-- Autrement dit, la suppression d'un projet MODIFIAIT une délibération figée au
-- registre légal — en silence, et sans passer par les policies de `decisions`
-- (une action de clé étrangère n'est pas soumise à la RLS de la table enfant).
--
-- Pourquoi un trigger et pas une policy : la RLS de `projets` régit qui supprime
-- un projet, pas l'effet de bord sur `decisions`. Et passer la FK en
-- `on delete restrict` interdirait TOUTE suppression de projet portant une
-- décision, alors que détacher une décision NON enregistrée reste légitime.
-- Seul un trigger exprime « bloque si, et seulement si, une décision est figée ».
--
-- `security definer` : le trigger doit voir toutes les décisions, indépendamment
-- de la RLS de l'appelant.
--
-- Ordre de nettoyage préservé : `nettoyage.sql` supprime les décisions AVANT les
-- projets, le trigger ne s'y déclenche donc pas.
-- =============================================================================

create or replace function projet_delete_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from decisions d where d.projet_id = old.id and d.enregistree) then
    raise exception 'Projet non supprimable : une décision enregistrée y est rattachée.'
      using errcode = 'restrict_violation';
  end if;
  return old;
end $$;

drop trigger if exists projets_delete_guard on projets;
create trigger projets_delete_guard
  before delete on projets
  for each row execute function projet_delete_guard();
