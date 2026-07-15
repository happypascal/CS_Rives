-- =============================================================================
-- Registre des Décisions du Conseil Syndical — Schéma Supabase (PostgreSQL)
-- ASL Lotissement de Rives, Nernier (74140)  —  modèle v3 (révisé 2026-07-14)
--
-- À exécuter dans le SQL Editor de Supabase (région eu-west / Paris).
-- Rôles applicatifs : 'admin' (président) tous droits ; 'membre' lecture +
-- son propre vote + Q&A. Le rôle vient de membres_cs.role ('president' => admin).
-- =============================================================================

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
  id               uuid primary key default gen_random_uuid(),
  numero           text not null unique,
  type             text not null check (type in ('AGO','AGE')),
  date_ag          date not null,
  lieu             text,
  president_seance text not null,
  ordre_du_jour    text,
  statut           text not null default 'en_cours' check (statut in ('en_cours','cloturee','annulee')),
  pv_url           text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------ resolutions_ag
-- Résultat seul : les voix (au prorata superficie) restent dans le PV.
create table if not exists resolutions_ag (
  id               uuid primary key default gen_random_uuid(),
  ag_id            uuid not null references assemblees_generales(id) on delete cascade,
  numero           integer not null,
  titre            text not null,
  description      text not null,
  majorite_requise text not null default 'simple' check (majorite_requise in ('simple','absolue','double_qualifiee','unanimite')),
  statut           text check (statut in ('adoptee','rejetee','retiree')),
  budget_alloue    numeric(12,2),
  budget_intitule  text,
  observations     text,
  created_at       timestamptz not null default now(),
  unique (ag_id, numero)
);

-- ------------------------------------------------------------ projets
-- Toujours issu d'une résolution AG ; hérite de son budget (modifiable).
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

-- ------------------------------------------------------------ decisions (CS)
create table if not exists decisions (
  id                   uuid primary key default gen_random_uuid(),
  numero               text not null unique,             -- AAAA-NNN
  titre                text not null,
  description          text not null,
  date_publication     date not null,                    -- postée le
  date_limite_reponse  date,                              -- défaut = +7 jours ouvrables
  date_enregistrement  date,                              -- actée par le président
  date_notification    timestamptz,                       -- dernier partage au CS (null = jamais notifiée)
  statut               text not null default 'en_cours' check (statut in ('en_cours','adoptee','rejetee')),
  enregistree          boolean not null default false,   -- verrou : non modifiable si true
  quorum_atteint       boolean,
  composition_snapshot jsonb,
  montant_engage       numeric(12,2),                    -- engagement (sur projet OU résolution)
  projet_id            uuid references projets(id) on delete set null,               -- engagement via projet
  ag_id                uuid references assemblees_generales(id) on delete set null,  -- rattachement AG
  resolution_id        uuid references resolutions_ag(id) on delete set null,        -- engagement direct résolution
  documents            jsonb not null default '[]',      -- pièces jointes [{id,name,type,size,dataUrl}]
  created_by           uuid references membres_cs(id),   -- owner = membre créateur (id membres_cs)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ------------------------------------------------------------ votes (self-only)
create table if not exists votes (
  id          uuid primary key default gen_random_uuid(),
  decision_id uuid not null references decisions(id) on delete cascade,
  membre_id   uuid not null references membres_cs(id) on delete cascade,
  vote        text not null check (vote in ('pour','contre','abstention')),
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

-- ------------------------------------------------------- signature_batches (par lot)
-- Une demande de signature couvre PLUSIEURS décisions sélectionnées.
create table if not exists signature_batches (
  id                 uuid primary key default gen_random_uuid(),
  titre              text,
  decision_ids       uuid[] not null,
  yousign_request_id text,
  statut             text not null default 'en_attente' check (statut in ('en_attente','signe','expire')),
  pdf_url            text,
  signataires        jsonb,
  created_at         timestamptz not null default now(),
  signed_at          timestamptz
);

-- ------------------------------------------------------- decision_status_history
create table if not exists decision_status_history (
  id             uuid primary key default gen_random_uuid(),
  decision_id    uuid not null references decisions(id) on delete cascade,
  ancien_statut  text,
  nouveau_statut text not null,
  changed_by     uuid references membres_cs(id),
  changed_at     timestamptz not null default now()
);

-- ------------------------------------------------------------ audit_log
create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  entite     text not null,
  entite_id  uuid,
  action     text not null,
  acteur     uuid references membres_cs(id),
  details    text,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- Helpers
-- =============================================================================
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membres_cs m
    where m.email = (auth.jwt() ->> 'email') and m.role = 'president' and m.actif
  );
$$;

create or replace function current_membre_id()
returns uuid language sql stable security definer set search_path = public as $$
  select m.id from membres_cs m where m.email = (auth.jwt() ->> 'email') limit 1;
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table membres_cs              enable row level security;
alter table assemblees_generales    enable row level security;
alter table resolutions_ag          enable row level security;
alter table projets                 enable row level security;
alter table decisions               enable row level security;
alter table votes                   enable row level security;
alter table questions_reponses      enable row level security;
alter table signature_batches       enable row level security;
alter table decision_status_history enable row level security;
alter table audit_log               enable row level security;

-- Lecture générale (authentifiés)
do $$
declare t text;
begin
  foreach t in array array[
    'membres_cs','assemblees_generales','resolutions_ag','projets','decisions','votes',
    'questions_reponses','signature_batches','decision_status_history','audit_log'
  ]
  loop
    execute format('drop policy if exists "read_auth" on %I;', t);
    execute format('create policy "read_auth" on %I for select to authenticated using (true);', t);
  end loop;
end $$;

-- Écriture admin (sauf votes / Q&A)
do $$
declare t text;
begin
  foreach t in array array[
    'membres_cs','assemblees_generales','resolutions_ag','projets','decisions',
    'signature_batches','decision_status_history','audit_log'
  ]
  loop
    execute format('drop policy if exists "write_admin" on %I;', t);
    execute format('create policy "write_admin" on %I for all to authenticated using (is_admin()) with check (is_admin());', t);
  end loop;
end $$;

-- Décisions : chaque membre porte les siennes. Tout membre actif crée (en
-- s'attribuant created_by) ; l'owner modifie / notifie tant que la décision
-- n'est pas enregistrée. Le `with check (… enregistree = false)` réserve l'acte
-- au président : l'owner ne peut ni poser le verrou, ni changer d'owner.
drop policy if exists "decisions_owner_insert" on decisions;
create policy "decisions_owner_insert" on decisions for insert to authenticated
  with check (
    created_by = current_membre_id()
    and exists (select 1 from membres_cs m where m.id = current_membre_id() and m.actif)
  );

drop policy if exists "decisions_owner_update" on decisions;
create policy "decisions_owner_update" on decisions for update to authenticated
  using (created_by = current_membre_id() and enregistree = false)
  with check (created_by = current_membre_id() and enregistree = false);

-- Votes : admin tout ; membre gère uniquement SON vote, et seulement tant que
-- la décision n'est pas enregistrée.
drop policy if exists "votes_admin" on votes;
create policy "votes_admin" on votes for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "votes_self_write" on votes;
create policy "votes_self_write" on votes for all to authenticated
  using (
    membre_id = current_membre_id()
    and exists (select 1 from decisions d where d.id = decision_id and d.enregistree = false)
  )
  with check (
    membre_id = current_membre_id()
    and exists (select 1 from decisions d where d.id = decision_id and d.enregistree = false)
  );

-- Q&A : admin tout ; membre peut ajouter (auteur = lui-même).
drop policy if exists "qa_admin" on questions_reponses;
create policy "qa_admin" on questions_reponses for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "qa_self_insert" on questions_reponses;
create policy "qa_self_insert" on questions_reponses for insert to authenticated
  with check (auteur_id = current_membre_id());

-- =============================================================================
-- NOTE Auth : créer les comptes (Authentication > Users) avec le MÊME email
-- que membres_cs. Pas d'auto-inscription (spec §4.1).
-- NOTE Documents : le stockage des pièces jointes en jsonb (dataUrl) convient
-- pour de petits fichiers. Pour de gros fichiers, utiliser Supabase Storage et
-- ne conserver que l'URL dans documents[].
-- =============================================================================
