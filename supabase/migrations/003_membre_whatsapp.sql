-- =============================================================================
-- Migration 003 — coordonnées WhatsApp des membres (notifications CallMeBot)
--
-- CallMeBot délivre une clé API PAR DESTINATAIRE : chaque membre autorise le
-- bot depuis son propre WhatsApp et reçoit sa clé personnelle. On stocke donc
-- le numéro ET la clé sur la ligne du membre.
--
-- Les deux colonnes sont facultatives : un membre sans numéro/clé ne reçoit
-- que l'email.
-- =============================================================================

alter table membres_cs add column if not exists telephone       text;
alter table membres_cs add column if not exists whatsapp_apikey text;

comment on column membres_cs.telephone is
  'Numéro WhatsApp au format international, ex. +41791234567';
comment on column membres_cs.whatsapp_apikey is
  'Clé CallMeBot personnelle du membre (obtenue en autorisant le bot depuis son WhatsApp)';
