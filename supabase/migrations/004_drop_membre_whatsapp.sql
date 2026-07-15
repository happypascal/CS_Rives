-- =============================================================================
-- Migration 004 — retrait des coordonnées WhatsApp des membres
--
-- Annule la 003. Les notifications automatiques (Resend + CallMeBot + webhook +
-- Edge Function) sont abandonnées : pour 4 membres, le président partage la
-- décision dans le groupe WhatsApp du CS depuis l'app (bouton « Prévenir le CS »).
--
-- On supprime les colonnes plutôt que de les laisser dormir : `whatsapp_apikey`
-- est une clé d'API, et une colonne morte finit toujours par être reprise.
-- =============================================================================

alter table membres_cs drop column if exists telephone;
alter table membres_cs drop column if exists whatsapp_apikey;
