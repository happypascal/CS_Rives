-- =============================================================================
-- Migration 011 — suspendre ou terminer un projet est une DÉCISION du CS
--
-- Règle (arbitrage Pascal 2026-07-16) : passer un projet à « terminé » ou
-- « suspendu » est le résultat d'une délibération et d'un vote du Conseil
-- Syndical. Ce n'est ni au chef de projet, ni au président de le faire seul.
--
-- `projets.statut` était une colonne saisie dans un formulaire : n'importe quel
-- gestionnaire la changeait d'un clic, sans vote, sans trace au registre. Elle
-- disparaît. Le statut se DÉRIVE désormais, comme le budget se dérive des
-- résolutions (cf. migration 009, même principe) :
--
--   aucun engagement                              → ouvert
--   de l'argent engagé                            → en_cours
--   dernière décision enregistrée = 'suspendre'   → suspendu
--   dernière décision enregistrée = 'terminer'    → termine
--
-- `decisions.projet_action` porte cet effet. Il ne s'applique QUE si la décision
-- est enregistrée ET adoptée — donc après quorum et vote. La DERNIÈRE décision
-- enregistrée l'emporte, ce qui rend 'reprendre' naturel et « terminé »
-- réversible (choix explicite de Pascal) : le CS peut rouvrir un projet, et cette
-- réouverture est elle-même une délibération tracée. Rien n'est irréversible ici
-- — contrairement à l'enregistrement d'une décision, qui l'est.
--
-- La colonne est nullable : l'immense majorité des décisions n'a aucun effet sur
-- le statut d'un projet, elles engagent juste de l'argent.
-- =============================================================================

alter table decisions
  add column if not exists projet_action text
  check (projet_action in ('suspendre', 'reprendre', 'terminer'));

comment on column decisions.projet_action is
  'Effet de cette décision sur le statut de son projet, appliqué une fois la décision enregistrée et adoptée (null = aucun effet)';

alter table projets drop column if exists statut;
