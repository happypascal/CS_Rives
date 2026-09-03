-- =============================================================================
-- Migration 045 — LA MÉMOIRE DU LOTISSEMENT
--
-- Demande de Pascal (2026-09-03) : « une base de connaissance par sujet dans
-- l'app. La mémoire du lotissement. »
--
-- Le besoin : le portail, la plage, les canalisations, la zone C, le
-- recouvrement, le cahier des charges… chacun de ces dossiers a une histoire de
-- plusieurs années, éparpillée dans des dossiers Finder, des courriels et la tête
-- du président sortant. Un nouveau conseil hérite des décisions mais pas du
-- POURQUOI, et refait les débats déjà tranchés.
--
-- -----------------------------------------------------------------------------
-- POURQUOI DEUX TABLES
--
-- Une mémoire utile répond à deux questions différentes :
--   - « où en est-on ? » → une SYNTHÈSE, réécrite au fil du temps, qui doit
--     rester juste aujourd'hui (`sujets.contenu`) ;
--   - « comment y est-on arrivé ? » → une CHRONOLOGIE, qui s'ajoute et ne se
--     réécrit pas (`sujet_entrees`).
-- Tout mettre dans un seul texte perdrait l'attribution et la date des faits, et
-- obligerait à rouvrir toute la page pour ajouter une ligne.
--
-- ⚠ `sujet_entrees.date_evenement` est la date où la chose S'EST PASSÉE, et elle
-- est MODIFIABLE — même raison que `journal_projet.date_action` : une réunion de
-- mars notée en juin se range en mars. `created_at` note la saisie et n'est
-- jamais modifié. Ne pas confondre les deux, sinon on date les faits du jour où
-- l'on a pensé à les écrire.
--
-- ⚠ `titre` est UNIQUE. Deux sujets « Portail » scinderaient la connaissance en
-- deux moitiés dont aucune ne serait complète — c'est exactement le mode de
-- ruine d'une base de connaissance.
--
-- ⚠ `categorie` est un texte LIBRE, sans contrainte : même choix que la catégorie
-- des pièces jointes d'AG (031). Une catégorie imprévue ne doit pas exiger une
-- migration.
--
-- -----------------------------------------------------------------------------
-- QUI LIT, QUI ÉCRIT
--
-- Lecture : TOUT membre connecté, via la boucle `read_auth`. ⚠ C'est l'inverse du
-- registre des propriétaires (035), et c'est voulu : celui-ci contient des données
-- personnelles de tiers, celui-là est la mémoire commune du conseil. La cacher
-- reviendrait à recréer le problème qu'on veut résoudre.
--
-- Écriture : la SYNTHÈSE est collective — tout membre actif peut l'améliorer. À
-- cinq personnes, l'arbitrage par le président suffit ; exiger une validation
-- garantirait surtout que rien ne soit jamais écrit. Les ENTRÉES, elles, suivent
-- la règle du journal de projet : chacun corrige les siennes, personne ne
-- réécrit le compte rendu d'un autre.
--
-- ⚠ LIMITE ASSUMÉE, v1 : aucun lien formel vers les décisions et les projets.
-- Ce serait la suite naturelle (« tout ce qui concerne le portail »), mais une
-- table de liaison est une complexité qu'on n'ajoute pas avant d'avoir vu
-- comment les sujets sont réellement utilisés. En attendant, on cite les numéros
-- de décision dans le texte.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbriqué, aucun
-- deux-points ni barre oblique dans une chaine, et une vérification SIMPLE.
-- =============================================================================

create table if not exists sujets (
  id          uuid primary key default gen_random_uuid(),
  titre       text not null unique,
  categorie   text,                  -- libre, sans contrainte (cf. 031)
  resume      text,                  -- une ligne, pour la liste
  contenu     text,                  -- la synthèse, HTML de RichTextEditor
  -- Mêmes pièces jointes que les projets et les AG : la ligne ne garde que
  -- {path,name,type,size}, le fichier vit dans le Storage (cf. 012).
  documents   jsonb not null default '[]'::jsonb,
  created_by  uuid references membres_cs(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists sujets_categorie_idx on sujets (categorie, titre);

create table if not exists sujet_entrees (
  id             uuid primary key default gen_random_uuid(),
  sujet_id       uuid not null references sujets(id) on delete cascade,
  -- Quand la chose s'est PASSÉE. Modifiable, contrairement à created_at.
  date_evenement date not null,
  titre          text not null,
  contenu        text,
  auteur_id      uuid not null references membres_cs(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- La chronologie se lit par sujet et se trie sur la date de l'ÉVÉNEMENT.
create index if not exists sujet_entrees_idx on sujet_entrees (sujet_id, date_evenement desc);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table sujets        enable row level security;
alter table sujet_entrees enable row level security;

-- Lecture : tout membre connecté, comme le reste de l'application.
drop policy if exists "read_auth" on sujets;
create policy "read_auth" on sujets for select to authenticated using (true);

drop policy if exists "read_auth" on sujet_entrees;
create policy "read_auth" on sujet_entrees for select to authenticated using (true);

-- Le président garde tout, comme partout ailleurs.
drop policy if exists "sujets_admin" on sujets;
create policy "sujets_admin" on sujets
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "sujet_entrees_admin" on sujet_entrees;
create policy "sujet_entrees_admin" on sujet_entrees
  for all to authenticated using (is_admin()) with check (is_admin());

-- La SYNTHÈSE est collective : tout membre ACTIF crée et améliore un sujet.
-- ⚠ Pas de suppression pour autant : effacer un sujet, c'est effacer une mémoire
-- que d'autres ont nourrie. Seul le président le peut, via la policy ci-dessus.
drop policy if exists "sujets_membre_insert" on sujets;
create policy "sujets_membre_insert" on sujets
  for insert to authenticated
  with check (exists (select 1 from membres_cs m where m.id = current_membre_id() and m.actif));

drop policy if exists "sujets_membre_update" on sujets;
create policy "sujets_membre_update" on sujets
  for update to authenticated
  using (exists (select 1 from membres_cs m where m.id = current_membre_id() and m.actif));

-- Les ENTRÉES suivent la règle du journal de projet : chacun les siennes.
drop policy if exists "sujet_entrees_self_insert" on sujet_entrees;
create policy "sujet_entrees_self_insert" on sujet_entrees
  for insert to authenticated
  with check (
    auteur_id = current_membre_id()
    and exists (select 1 from membres_cs m where m.id = current_membre_id() and m.actif)
  );

drop policy if exists "sujet_entrees_self_update" on sujet_entrees;
create policy "sujet_entrees_self_update" on sujet_entrees
  for update to authenticated
  using (auteur_id = current_membre_id());

drop policy if exists "sujet_entrees_self_delete" on sujet_entrees;
create policy "sujet_entrees_self_delete" on sujet_entrees
  for delete to authenticated
  using (auteur_id = current_membre_id());
