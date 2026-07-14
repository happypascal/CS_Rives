-- =============================================================================
-- Migration 002 — Ajout de l'entité Projet.
-- À exécuter UNE FOIS dans le SQL Editor (base déjà créée).
-- =============================================================================

create table if not exists projets (
  id             uuid primary key default gen_random_uuid(),
  nom            text not null,
  description    text,
  chef_projet_id uuid references membres_cs(id),
  ag_id          uuid references assemblees_generales(id) on delete set null,
  resolution_id  uuid not null references resolutions_ag(id) on delete restrict,
  budget_alloue  numeric(12,2),
  statut         text not null default 'ouvert' check (statut in ('ouvert','en_cours','termine','suspendu')),
  documents      jsonb not null default '[]',
  date_ouverture date,
  date_cloture   date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table decisions add column if not exists projet_id uuid references projets(id) on delete set null;

-- RLS : lecture authentifiés, écriture admin.
alter table projets enable row level security;

drop policy if exists "read_auth" on projets;
create policy "read_auth" on projets for select to authenticated using (true);

drop policy if exists "write_admin" on projets;
create policy "write_admin" on projets for all to authenticated using (is_admin()) with check (is_admin());
