-- =============================================================================
-- Migration 028 — ADJOINT au chef de projet, et FIL D'ÉCHANGES sur les projets
--
-- Besoin (Pascal, 2026-08-25) : « vu l'emploi du temps des uns et des autres
-- dans le CS », un projet ne peut pas reposer sur une seule personne. D'où un
-- adjoint, facultatif, forcément un AUTRE membre du CS, aux mêmes droits que le
-- chef. Et un fil questions / réponses / commentaires par projet, pour garder
-- une trace écrite des échanges de l'équipe.
--
-- ⚠ NE COUVRE PAS le rôle « membre de l'équipe projet » ouvert aux colotis,
-- demandé en même temps : ce n'est pas un rôle de plus, c'est l'ouverture de
-- l'application à des personnes qui ne sont pas membres du CS. Aujourd'hui
-- `read_auth` est un `using (true)` sur TOUTES les tables : le premier compte
-- coloti créé lirait l'intégralité du registre, les votes nominatifs compris.
-- Cela demande de refermer et réécrire la lecture de chaque table, et une
-- identité distincte de `membres_cs` (y verser un coloti le ferait compter dans
-- le quorum, cf. `activeMembersAt`). Chantier à part, à éprouver sur staging.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase, incidents du 2026-08-25) : aucune
-- chaine vide, aucun argument de formatage de `raise`, aucun guillemet dollar
-- imbriqué, aucun deux-points dans une chaine.
-- =============================================================================

-- --------------------------------------------------------------------------
-- 1. ADJOINT au chef de projet
--
-- Colonne nullable : l'adjoint est FACULTATIF, un projet mené seul reste la
-- norme. FK vers `membres_cs`, ce qui garantit à soi seul « forcément un autre
-- membre du CS » — la table ne contient que le conseil.
--
-- La contrainte dit le « AUTRE » : adjoint et chef ne peuvent pas être la même
-- personne. `is distinct from` et non `<>` : avec `<>`, deux valeurs nulles
-- donnent NULL, la contrainte serait considérée satisfaite par accident plutôt
-- que par intention.
alter table projets add column if not exists adjoint_projet_id uuid references membres_cs(id);

alter table projets drop constraint if exists projets_adjoint_distinct_chef;
alter table projets add constraint projets_adjoint_distinct_chef
  check (adjoint_projet_id is null or adjoint_projet_id is distinct from chef_projet_id);

create index if not exists projets_adjoint_idx on projets (adjoint_projet_id);

-- Mêmes droits que le chef, sans exception : la policy d'UPDATE accepte
-- désormais l'un ou l'autre. C'est le seul endroit à changer — la LECTURE est
-- déjà ouverte à tout membre connecté (`read_auth`), donc « il voit tout »
-- n'ajoute rien pour un membre du CS ; ce que l'adjoint gagne, c'est le droit
-- d'ÉCRIRE sur le projet.
--
-- L'INSERT n'est pas touché : créer un projet, c'est en devenir le chef. On
-- désigne son adjoint ensuite, ou dans la foulée depuis le formulaire.
drop policy if exists "projets_chef_update" on projets;
create policy "projets_chef_update" on projets for update to authenticated
  using (
    chef_projet_id = current_membre_id()
    or adjoint_projet_id = current_membre_id()
  )
  with check (
    chef_projet_id = current_membre_id()
    or adjoint_projet_id = current_membre_id()
  );

-- ⚠ La SUPPRESSION reste au président (`write_admin`), inchangée : le chef ne
-- supprimait pas son projet (migration 013), l'adjoint pas davantage.

-- --------------------------------------------------------------------------
-- 2. FIL D'ÉCHANGES sur les projets
--
-- Même forme que `questions_reponses` côté décisions (migration 019) : un fil
-- de questions avec leurs réponses, plus des commentaires libres. Reprendre la
-- même structure plutôt qu'en inventer une autre — deux modèles d'échange dans
-- la même app finiraient par diverger, et l'écran serait à réécrire deux fois.
--
-- Différence tenue avec les décisions : une décision est FIGÉE à
-- l'enregistrement, donc le fil s'y ferme (policy `qa_no_insert_when_locked`,
-- migration 021). Un projet ne se fige jamais — son suivi continue tant qu'il
-- vit. Aucune garde de verrouillage ici, donc, et c'est voulu.
create table if not exists questions_reponses_projet (
  id         uuid primary key default gen_random_uuid(),
  projet_id  uuid not null references projets(id) on delete cascade,
  auteur_id  uuid not null references membres_cs(id) on delete cascade,
  type       text not null check (type in ('question','reponse','commentaire')),
  parent_id  uuid references questions_reponses_projet(id) on delete cascade,
  texte      text not null,
  created_at timestamptz not null default now()
);

create index if not exists qa_projet_projet_idx on questions_reponses_projet (projet_id);

-- ⚠ `auteur_id` pointe `membres_cs`, donc le fil est aujourd'hui réservé au CS.
-- C'est exactement la ligne que devra franchir le chantier « équipe projet
-- ouverte aux colotis » : il faudra une identité qui ne soit pas le conseil.
-- Ne pas contourner en versant des colotis dans `membres_cs`.

alter table questions_reponses_projet enable row level security;

-- Lecture : comme partout ailleurs, tout membre connecté lit tout.
drop policy if exists "read_auth" on questions_reponses_projet;
create policy "read_auth" on questions_reponses_projet
  for select to authenticated using (true);

drop policy if exists "qa_projet_admin" on questions_reponses_projet;
create policy "qa_projet_admin" on questions_reponses_projet
  for all to authenticated using (is_admin()) with check (is_admin());

-- On écrit sous SON nom, et seulement si l'on est un membre ACTIF : un mandat
-- terminé ne poste plus. Même règle que `qa_self_insert` côté décisions.
drop policy if exists "qa_projet_self_insert" on questions_reponses_projet;
create policy "qa_projet_self_insert" on questions_reponses_projet
  for insert to authenticated
  with check (
    auteur_id = current_membre_id()
    and exists (select 1 from membres_cs m where m.id = current_membre_id() and m.actif)
  );
