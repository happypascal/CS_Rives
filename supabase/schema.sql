-- =============================================================================
-- Registre des Décisions du Conseil Syndical — Schéma Supabase (PostgreSQL)
-- ASL Lotissement de Rives, Nernier (74140)
--
-- À exécuter dans le SQL Editor de Supabase (région eu-west / Paris).
-- Idempotent autant que possible. Les rôles applicatifs :
--   - 'admin'  (président) : tous droits
--   - 'membre'            : lecture, saisie de son vote, ajout Q&A
-- Le rôle est porté par membres_cs.role ('president' => admin).
-- =============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------- membres
create table if not exists membres_cs (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  prenom        text not null,
  email         text not null,
  role          text not null default 'membre' check (role in ('president','membre')),
  date_election date not null,
  date_fin      date,
  ag_election   text,
  actif         boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------ assemblees_generales
create table if not exists assemblees_generales (
  id                     uuid primary key default gen_random_uuid(),
  numero                 text not null unique,
  type                   text not null check (type in ('AGO','AGE')),
  date_ag                date not null,
  lieu                   text,
  president_seance       text not null,
  ordre_du_jour          text,
  quorum_atteint         boolean,
  nombre_presents        integer default 0,
  nombre_representes     integer default 0,
  nombre_total           integer default 0,
  superficie_representee numeric(10,2) default 0,
  statut                 text not null default 'en_cours' check (statut in ('en_cours','cloturee','annulee')),
  pv_url                 text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ------------------------------------------------------------ resolutions_ag
create table if not exists resolutions_ag (
  id               uuid primary key default gen_random_uuid(),
  ag_id            uuid not null references assemblees_generales(id) on delete cascade,
  numero           integer not null,
  titre            text not null,
  description      text not null,
  votes_pour       integer default 0,
  votes_contre     integer default 0,
  votes_abstention integer default 0,
  votes_absents    integer default 0,
  superficie_pour  numeric(10,2) default 0,
  statut           text check (statut in ('adoptee','rejetee','retiree')),
  majorite_requise text not null default 'simple' check (majorite_requise in ('simple','double_qualifiee','unanimite')),
  observations     text,
  created_at       timestamptz not null default now(),
  unique (ag_id, numero)
);

-- ------------------------------------------------------------ budgets_ag
create table if not exists budgets_ag (
  id               uuid primary key default gen_random_uuid(),
  ag_id            uuid not null references assemblees_generales(id) on delete cascade,
  resolution_id    uuid references resolutions_ag(id) on delete set null,
  intitule         text not null,
  montant_vote     numeric(12,2) not null default 0,
  cle_repartition  text not null default 'superficie' check (cle_repartition in ('superficie','facade','egal')),
  statut           text not null default 'vote' check (statut in ('vote','appele','encaisse','solde')),
  date_appel_prevu date,
  montant_appele   numeric(12,2) default 0,
  montant_encaisse numeric(12,2) default 0,
  observations     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------ decisions (CS)
create table if not exists decisions (
  id                   uuid primary key default gen_random_uuid(),
  numero               text not null unique,
  date_decision        date not null,
  titre                text not null,
  description          text not null,
  ag_id                uuid references assemblees_generales(id) on delete set null,
  resolution_id        uuid references resolutions_ag(id) on delete set null,
  statut               text not null default 'en_cours' check (statut in ('en_cours','adoptee','rejetee')),
  cloture              boolean not null default false,
  quorum_atteint       boolean,
  composition_snapshot jsonb,
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ------------------------------------------------------------ votes
create table if not exists votes (
  id          uuid primary key default gen_random_uuid(),
  decision_id uuid not null references decisions(id) on delete cascade,
  membre_id   uuid not null references membres_cs(id) on delete cascade,
  vote        text not null check (vote in ('pour','contre','abstention','absent')),
  commentaire text,
  date_vote   timestamptz not null default now(),
  unique (decision_id, membre_id)
);

-- ------------------------------------------------------------ questions_reponses
create table if not exists questions_reponses (
  id          uuid primary key default gen_random_uuid(),
  decision_id uuid not null references decisions(id) on delete cascade,
  auteur_id   uuid not null references membres_cs(id) on delete cascade,
  type        text not null check (type in ('question','reponse')),
  parent_id   uuid references questions_reponses(id) on delete cascade,
  texte       text not null,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------ registre_signatures
create table if not exists registre_signatures (
  id                 uuid primary key default gen_random_uuid(),
  decision_id        uuid not null references decisions(id) on delete cascade unique,
  yousign_request_id text,
  statut             text default 'en_attente' check (statut in ('en_attente','signe','expire')),
  pdf_url            text,
  signataires        jsonb,
  created_at         timestamptz not null default now(),
  signed_at          timestamptz
);

-- ------------------------------------------------------- decision_status_history
create table if not exists decision_status_history (
  id            uuid primary key default gen_random_uuid(),
  decision_id   uuid not null references decisions(id) on delete cascade,
  ancien_statut text,
  nouveau_statut text not null,
  changed_by    uuid references auth.users(id),
  changed_at    timestamptz not null default now()
);

-- ------------------------------------------------------------ audit_log
create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  entite     text not null,
  entite_id  uuid,
  action     text not null,
  acteur     uuid references auth.users(id),
  details    text,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- Helper : l'utilisateur courant est-il président (admin) ?
-- Le lien se fait par email entre auth.users et membres_cs.
-- =============================================================================
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from membres_cs m
    where m.email = (auth.jwt() ->> 'email')
      and m.role = 'president'
      and m.actif
  );
$$;

create or replace function current_membre_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id from membres_cs m
  where m.email = (auth.jwt() ->> 'email')
  limit 1;
$$;

-- =============================================================================
-- Row Level Security
--   Lecture : tout utilisateur authentifié (données privées au CS).
--   Écriture : admin partout ; un membre peut insérer/mettre à jour SON vote
--   et ajouter des Q&A.
-- =============================================================================
alter table membres_cs             enable row level security;
alter table assemblees_generales   enable row level security;
alter table resolutions_ag         enable row level security;
alter table budgets_ag             enable row level security;
alter table decisions              enable row level security;
alter table votes                  enable row level security;
alter table questions_reponses     enable row level security;
alter table registre_signatures    enable row level security;
alter table decision_status_history enable row level security;
alter table audit_log              enable row level security;

-- Lecture générale (authentifiés)
do $$
declare t text;
begin
  foreach t in array array[
    'membres_cs','assemblees_generales','resolutions_ag','budgets_ag',
    'decisions','votes','questions_reponses','registre_signatures',
    'decision_status_history','audit_log'
  ]
  loop
    execute format('drop policy if exists "read_auth" on %I;', t);
    execute format('create policy "read_auth" on %I for select to authenticated using (true);', t);
  end loop;
end $$;

-- Écriture réservée à l'admin (toutes tables sauf votes / Q&A qui ont des règles propres)
do $$
declare t text;
begin
  foreach t in array array[
    'membres_cs','assemblees_generales','resolutions_ag','budgets_ag',
    'decisions','registre_signatures','decision_status_history','audit_log'
  ]
  loop
    execute format('drop policy if exists "write_admin" on %I;', t);
    execute format('create policy "write_admin" on %I for all to authenticated using (is_admin()) with check (is_admin());', t);
  end loop;
end $$;

-- Votes : admin tout ; membre peut gérer uniquement son propre vote.
drop policy if exists "votes_admin" on votes;
create policy "votes_admin" on votes for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "votes_self_insert" on votes;
create policy "votes_self_insert" on votes for insert to authenticated
  with check (membre_id = current_membre_id());

drop policy if exists "votes_self_update" on votes;
create policy "votes_self_update" on votes for update to authenticated
  using (membre_id = current_membre_id()) with check (membre_id = current_membre_id());

-- Q&A : admin tout ; membre peut ajouter (auteur = lui-même).
drop policy if exists "qa_admin" on questions_reponses;
create policy "qa_admin" on questions_reponses for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "qa_self_insert" on questions_reponses;
create policy "qa_self_insert" on questions_reponses for insert to authenticated
  with check (auteur_id = current_membre_id());

-- =============================================================================
-- NOTE Auth : créer les comptes des membres via le dashboard Supabase
-- (Authentication > Users) ou l'API admin, avec le MÊME email que membres_cs.
-- Pas d'auto-inscription (spec §4.1).
-- =============================================================================
