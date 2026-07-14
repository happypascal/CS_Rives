-- =============================================================================
-- Amorçage (bootstrap) — À exécuter UNE FOIS après schema.sql, dans le
-- SQL Editor de Supabase (qui s'exécute en service_role et contourne le RLS).
--
-- ⚠️ IMPORTANT :
--   1. Adaptez les lignes ci-dessous (noms, emails, dates réels du CS).
--   2. Le champ `email` DOIT être identique à celui du compte de connexion créé
--      dans Authentication > Users (voir docs/DEPLOIEMENT.md).
--   3. Il faut AU MOINS un membre role='president' actif : c'est lui qui pourra
--      ensuite gérer les autres depuis l'app (le RLS s'appuie sur is_admin()).
-- =============================================================================

insert into membres_cs (nom, prenom, email, role, date_election, ag_election, actif)
values
  -- Président (admin) — remplacez par les vraies valeurs
  ('Favre',  'Pascal', 'pfavre25@gmail.com',        'president', '2025-06-19', 'AGO 19 juin 2025', true),
  -- Membres du CS
  ('Martin', 'Claire', 'claire.martin@example.fr',  'membre',    '2025-06-19', 'AGO 19 juin 2025', true),
  ('Dubois', 'Henri',  'henri.dubois@example.fr',   'membre',    '2025-06-19', 'AGO 19 juin 2025', true),
  ('Leroy',  'Sophie', 'sophie.leroy@example.fr',   'membre',    '2025-06-19', 'AGO 19 juin 2025', true)
on conflict do nothing;

-- (Optionnel) Une première AG pour tester :
-- insert into assemblees_generales (numero, type, date_ag, lieu, president_seance, statut)
-- values ('AGO-2025-01', 'AGO', '2025-06-19', 'Salle des fêtes de Nernier', 'Pascal Favre', 'cloturee');
