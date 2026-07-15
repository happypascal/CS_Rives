-- =============================================================================
-- Migration 005 — trace de notification du CS
--
-- Horodate le partage de la décision dans le groupe WhatsApp (bouton
-- « Prévenir le CS »), pour ne pas notifier deux fois par inadvertance.
--
-- Champ séparé et NON une valeur de `statut` : `statut` porte le résultat du
-- vote (en_cours / adoptee / rejetee), la notification est un axe indépendant
-- qui se combine avec chacun de ces états.
--
-- L'envoi étant manuel, la date atteste que le président a lancé le partage —
-- pas que le message a effectivement été envoyé. Une relance reste possible.
-- =============================================================================

alter table decisions add column if not exists date_notification timestamptz;

comment on column decisions.date_notification is
  'Date du dernier partage de la décision au CS (null = jamais notifiée)';
