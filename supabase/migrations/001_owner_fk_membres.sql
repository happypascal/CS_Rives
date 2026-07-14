-- =============================================================================
-- Migration 001 — Corrige les clés étrangères "owner" (created_by / changed_by /
-- acteur) pour qu'elles pointent vers membres_cs(id) et non auth.users(id).
--
-- Pourquoi : l'app identifie le créateur/acteur par l'id membres_cs (cohérence
-- mode démo ↔ Supabase). Sans ça, created_by ne se remplit pas (violation de FK)
-- et l'auteur d'une décision ne peut pas la modifier.
--
-- À exécuter UNE FOIS dans le SQL Editor si tu as créé la base avec l'ancien
-- schema.sql. (Le nouveau schema.sql est déjà corrigé.)
-- =============================================================================

alter table decisions               drop constraint if exists decisions_created_by_fkey;
alter table decisions               add  constraint decisions_created_by_fkey
  foreign key (created_by) references membres_cs(id) on delete set null;

alter table decision_status_history drop constraint if exists decision_status_history_changed_by_fkey;
alter table decision_status_history add  constraint decision_status_history_changed_by_fkey
  foreign key (changed_by) references membres_cs(id) on delete set null;

alter table audit_log               drop constraint if exists audit_log_acteur_fkey;
alter table audit_log               add  constraint audit_log_acteur_fkey
  foreign key (acteur) references membres_cs(id) on delete set null;
