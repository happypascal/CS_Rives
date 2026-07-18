-- =============================================================================
-- Migration 014 — rôles du bureau : trésorier et secrétaire
--
-- Art. 14 des statuts : le président désigne, parmi les membres, un trésorier et
-- un secrétaire (optionnels, un seul de chaque). On élargit `membres_cs.role` et
-- on ajoute les helpers RLS `is_secretaire()` / `is_tresorier()`, sur le modèle
-- exact de `is_admin()` (= président).
--
-- INERTE : personne ne porte encore ces rôles, et aucune policy ne s'appuie
-- encore sur les nouveaux helpers (ils sont créés ici, câblés aux points 2-5).
-- Applicable sans coordination. Le code qui propose les rôles dans la page
-- Membres suit ; tant qu'il n'est pas déployé, l'élargissement du check ne change
-- rien.
--
-- Rôles EXCLUSIFS (un par membre, arbitrage Pascal) : non contraint en base ici
-- — un membre ne peut de toute façon porter qu'une valeur de `role`. L'unicité
-- « un seul trésorier » reste applicative (garde dans la page Membres).
-- =============================================================================

-- ⚠ Balises de dollar-quote NOMMÉES ($secretaire$ / $tresorier$), pas des $$
-- anonymes : l'éditeur SQL de Supabase perd le fil quand deux fonctions $$ se
-- suivent (« unterminated dollar-quoted string »). En cas de doute, exécuter
-- chaque instruction séparément.

alter table membres_cs drop constraint if exists membres_cs_role_check;
alter table membres_cs add constraint membres_cs_role_check
  check (role in ('president','tresorier','secretaire','membre'));

create or replace function is_secretaire()
returns boolean language sql stable security definer set search_path = public as $secretaire$
  select exists (select 1 from membres_cs m where m.email = (auth.jwt() ->> 'email') and m.role = 'secretaire' and m.actif);
$secretaire$;

create or replace function is_tresorier()
returns boolean language sql stable security definer set search_path = public as $tresorier$
  select exists (select 1 from membres_cs m where m.email = (auth.jwt() ->> 'email') and m.role = 'tresorier' and m.actif);
$tresorier$;
