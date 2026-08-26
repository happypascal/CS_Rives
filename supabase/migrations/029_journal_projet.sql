-- =============================================================================
-- Migration 029 — JOURNAL DE BORD des projets
--
-- Besoin (Pascal, 2026-08-26) : « un journal des actions effectuées dans le
-- projet avec une date modifiable ». Ce que l'équipe a FAIT — visite de chantier,
-- relance du prestataire, rendez-vous en mairie —, daté du jour où ça s'est
-- passé.
--
-- ⚠ À NE PAS CONFONDRE avec `audit_log`, qui existe déjà : celui-là est
-- automatique, technique et immuable (qui a changé quoi dans l'application, et
-- quand). Celui-ci est saisi à la main, métier, et corrigeable. Deux journaux,
-- deux usages ; les mélanger rendrait l'un et l'autre illisibles.
--
-- DEUX DATES, et c'est tout l'objet de la demande :
--   - `date_action` : quand l'action a eu lieu. MODIFIABLE — on note souvent
--     après coup, et le 20 août on consigne une visite du 12 ;
--   - `created_at`  : quand la ligne a été saisie. JAMAIS modifiée.
-- Les confondre reviendrait à dater les faits du jour où on a pensé à les
-- écrire.
--
-- Le journal n'est PAS une délibération : il n'entre pas au registre légal, il
-- ne se fige pas, et ses lignes restent corrigeables par leur auteur. C'est un
-- suivi de chantier, pas un acte — d'où l'absence de tout verrou.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase, incidents du 2026-08-25) : aucune
-- chaine vide, aucun argument de formatage de `raise`, aucun guillemet dollar
-- imbriqué, aucun deux-points dans une chaine.
-- =============================================================================

create table if not exists journal_projet (
  id          uuid primary key default gen_random_uuid(),
  projet_id   uuid not null references projets(id) on delete cascade,
  date_action date not null,                       -- quand ça s'est passé (modifiable)
  texte       text not null,
  auteur_id   uuid not null references membres_cs(id) on delete cascade,
  created_at  timestamptz not null default now(),  -- quand ça a été saisi (jamais modifié)
  updated_at  timestamptz not null default now()
);

-- Index sur (projet, date d'action) : le journal se lit toujours par projet et
-- se trie sur la date de l'ACTION, jamais sur celle de la saisie.
create index if not exists journal_projet_idx on journal_projet (projet_id, date_action desc);

alter table journal_projet enable row level security;

-- Lecture : comme partout, tout membre connecté lit tout.
drop policy if exists "read_auth" on journal_projet;
create policy "read_auth" on journal_projet for select to authenticated using (true);

drop policy if exists "journal_projet_admin" on journal_projet;
create policy "journal_projet_admin" on journal_projet
  for all to authenticated using (is_admin()) with check (is_admin());

-- On écrit sous SON nom, et seulement si l'on est membre ACTIF : un mandat
-- terminé ne consigne plus. Même règle que les fils de questions/réponses.
drop policy if exists "journal_projet_self_insert" on journal_projet;
create policy "journal_projet_self_insert" on journal_projet
  for insert to authenticated
  with check (
    auteur_id = current_membre_id()
    and exists (select 1 from membres_cs m where m.id = current_membre_id() and m.actif)
  );

-- L'AUTEUR corrige et supprime SA ligne — c'est précisément ce que « date
-- modifiable » demande. Pas de garde de temps ni de verrou : une erreur de date
-- se corrige le mois suivant si besoin. Ce n'est pas un registre légal.
--
-- ⚠ Volontairement borné à l'auteur : le chef de projet et son adjoint pilotent
-- le projet, ils ne réécrivent pas le compte rendu de quelqu'un d'autre. Le
-- président garde tout via `journal_projet_admin`, comme partout.
drop policy if exists "journal_projet_self_update" on journal_projet;
create policy "journal_projet_self_update" on journal_projet
  for update to authenticated
  using (auteur_id = current_membre_id());

drop policy if exists "journal_projet_self_delete" on journal_projet;
create policy "journal_projet_self_delete" on journal_projet
  for delete to authenticated
  using (auteur_id = current_membre_id());
