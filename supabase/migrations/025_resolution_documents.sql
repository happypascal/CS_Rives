-- =============================================================================
-- Migration 025 — pièces jointes sur les résolutions d'AG
--
-- Même mécanisme que les décisions et les projets (bucket privé `documents`,
-- migration 012) : `documents[]` ne garde que {path,name,type,size}, le fichier
-- vit dans le Storage. Convention de chemin : resolutions/<resolution_id>/<uuid>.
--
-- AUCUNE nouvelle policy Storage nécessaire :
--   - insert (`documents_insert_membre`) : exige un membre actif ; son NOT EXISTS
--     ne porte que sur les décisions enregistrées, donc un chemin `resolutions/…`
--     (qui ne matche aucune décision) passe — comme les chemins `projets/…`.
--   - delete (`documents_delete`) : `is_admin()` couvre les chemins non-décision
--     (président), ce qui correspond au droit de gestion des AG.
-- =============================================================================

alter table resolutions_ag add column if not exists documents jsonb not null default '[]';
