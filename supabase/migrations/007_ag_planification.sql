-- 007 — Planifier une AG avant qu'elle ait lieu.
--
-- Le modèle initial supposait qu'on saisissait une AG APRÈS coup (compte rendu).
-- En usage réel on planifie l'AG d'abord : à ce moment ni le président de séance
-- ni le résultat des votes n'existent. Deux contraintes rendaient ce cas impossible.
--
-- 1. president_seance NOT NULL
--    Le président de séance est désigné EN séance (il n'est pas connu à la
--    convocation). L'exiger forçait à inventer un nom, donc à écrire au registre
--    une information fausse — inacceptable pour un registre légal.
--
-- 2. resolutions_ag.statut in ('adoptee','rejetee','retiree')
--    Aucun état « pas encore voté ». Une résolution inscrite à l'ordre du jour
--    d'une AG à venir devait être marquée « adoptée » avant tout vote, ce qui
--    faisait compter son budget comme alloué et permettait d'engager des dépenses
--    sur un budget que l'AG n'avait pas encore voté.
--    → ajout de 'a_voter', qui devient le défaut.
--
-- La colonne statut reste nullable (données historiques) ; le défaut ne s'applique
-- qu'aux nouvelles lignes. Les résolutions existantes gardent leur valeur.

alter table assemblees_generales
  alter column president_seance drop not null;

alter table resolutions_ag
  drop constraint if exists resolutions_ag_statut_check;

alter table resolutions_ag
  add constraint resolutions_ag_statut_check
  check (statut in ('a_voter', 'adoptee', 'rejetee', 'retiree'));

alter table resolutions_ag
  alter column statut set default 'a_voter';
