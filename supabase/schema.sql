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
  role          text not null default 'membre' check (role in ('president','tresorier','secretaire','membre')),
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
  president_seance text,                                  -- désigné EN séance : inconnu à la planification
  ordre_du_jour    text,
  statut           text not null default 'en_cours' check (statut in ('en_cours','cloturee','annulee')),
  pv_url           text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------ resolutions_ag
-- Résultat seul : les voix (au prorata superficie) restent dans le PV.
-- Cycle : 'a_voter' (inscrite à l'ordre du jour, AG pas encore tenue) → résultat.
-- Seule une résolution 'adoptee' alloue réellement un budget (cf. computeAGBudgets).
--
-- `projet_id` (ajouté plus bas par alter, cf. dépendance circulaire) : le projet
-- que cette enveloppe finance. C'est la RÉSOLUTION qui pointe le projet, jamais
-- l'inverse — une colonne scalaire ne contenant qu'une valeur, la règle « une
-- résolution ne finance qu'un projet » est structurelle, sans contrainte à écrire.
-- Le sens inverse est libre : PLUSIEURS résolutions peuvent pointer le même projet
-- (augmentation de budget votée plus tard, projet mené en phases) — donc surtout
-- pas d'unique sur projet_id.
create table if not exists resolutions_ag (
  id               uuid primary key default gen_random_uuid(),
  ag_id            uuid not null references assemblees_generales(id) on delete cascade,
  numero           integer not null,
  titre            text not null,
  description      text not null,
  majorite_requise text not null default 'simple' check (majorite_requise in ('simple','absolue','double_qualifiee','unanimite')),
  statut           text default 'a_voter' check (statut in ('a_voter','adoptee','rejetee','retiree')),
  budget_alloue    numeric(12,2),
  budget_intitule  text,
  observations     text,
  created_at       timestamptz not null default now(),
  unique (ag_id, numero)
);

-- ------------------------------------------------------------ projets
-- Exécution par le CS d'une ou plusieurs résolutions d'AG adoptées.
--
-- Le projet ne porte NI budget NI AG : les deux se dérivent des résolutions qui
-- le pointent (`resolutions_ag.projet_id`).
--   - budget = somme des `budget_alloue` des résolutions ADOPTÉES rattachées
--     (cf. computeProjectBudgets). Le stocker créerait une divergence silencieuse
--     dès qu'une résolution est ajoutée ou change de statut.
--   - AG d'origine = celles des résolutions rattachées. Un projet financé sur deux
--     exercices a deux AG d'origine ; une colonne `ag_id` unique mentirait.
--   - statut = dérivé des engagements et des décisions portant un `projet_action`
--     (cf. computeProjectBudgets). Suspendre ou terminer un projet est une
--     délibération du CS, pas une case à cocher : la colonne a été supprimée
--     (migration 011) pour qu'aucun écran ne puisse la changer sans vote.
create table if not exists projets (
  id             uuid primary key default gen_random_uuid(),
  nom            text not null,
  description    text,
  chef_projet_id uuid references membres_cs(id),           -- chef = rôle fonctionnel ET ancre de permission (le chef modifie)
  documents      jsonb not null default '[]',
  date_ouverture date,
  date_cloture   date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- resolutions_ag → projets : posé après coup, les deux tables se référençant
-- mutuellement (projets n'existe pas encore au create de resolutions_ag).
-- `on delete set null` : supprimer un projet DÉTACHE ses résolutions, il ne les
-- détruit pas — une résolution votée par l'AG survit toujours à un projet du CS.
alter table resolutions_ag
  add column if not exists projet_id uuid references projets(id) on delete set null;

create index if not exists resolutions_ag_projet_id_idx on resolutions_ag (projet_id);

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
  projet_action        text check (projet_action in ('suspendre','reprendre','terminer')),  -- effet sur le statut du projet, appliqué une fois enregistrée ET adoptée
  documents            jsonb not null default '[]',      -- pièces jointes [{id,name,type,size,dataUrl}]
  created_by           uuid references membres_cs(id),   -- owner = membre créateur (id membres_cs)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Un projet portant une décision ENREGISTRÉE n'est plus supprimable (couvre la
-- règle « de l'argent y est engagé » : l'engagement vient toujours d'une décision
-- enregistrée et adoptée). Sans ce trigger, le `on delete set null` de
-- `decisions.projet_id` détacherait ces décisions — donc MODIFIERAIT une
-- délibération figée au registre, en silence et hors RLS (une action de clé
-- étrangère n'est pas soumise aux policies de la table enfant). Un
-- `on delete restrict` serait trop large : détacher une décision NON enregistrée
-- reste légitime. Déclaré ici, après `decisions`, dont il dépend.
create or replace function projet_delete_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from decisions d where d.projet_id = old.id and d.enregistree) then
    raise exception 'Projet non supprimable : une décision enregistrée y est rattachée.'
      using errcode = 'restrict_violation';
  end if;
  return old;
end $$;

drop trigger if exists projets_delete_guard on projets;
create trigger projets_delete_guard
  before delete on projets
  for each row execute function projet_delete_guard();

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
  type        text not null check (type in ('question','reponse','commentaire')),
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

-- ------------------------------------------------------- comptes_ag (co-validation)
-- Une ligne d'approbation par rôle (tresorier / president). « Comptes validés »
-- = les deux lignes existent pour l'AG (migration 017, point 4).
create table if not exists comptes_ag (
  id           uuid primary key default gen_random_uuid(),
  ag_id        uuid not null references assemblees_generales(id) on delete cascade,
  role         text not null check (role in ('tresorier','president')),
  approuve_par uuid references membres_cs(id),
  approuve_le  timestamptz not null default now(),
  unique (ag_id, role)
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
returns boolean language sql stable security definer set search_path = public as $is_admin$
  select exists (
    select 1 from membres_cs m
    where lower(m.email) = lower(auth.jwt() ->> 'email') and m.role = 'president' and m.actif
  );
$is_admin$;

-- Rôles du bureau (art. 14, migration 014). Mêmes forme et sémantique que
-- is_admin(). Câblés aux droits « faire signer » (secrétaire) et « valider les
-- comptes » (trésorier) — cf. points 2-5 de docs/SPEC_ROLES.md.
-- Balises nommées ($secretaire$ / $tresorier$) : l'éditeur Supabase parse mal
-- deux fonctions $$ qui se suivent.
create or replace function is_secretaire()
returns boolean language sql stable security definer set search_path = public as $secretaire$
  select exists (select 1 from membres_cs m where lower(m.email) = lower(auth.jwt() ->> 'email') and m.role = 'secretaire' and m.actif);
$secretaire$;

create or replace function is_tresorier()
returns boolean language sql stable security definer set search_path = public as $tresorier$
  select exists (select 1 from membres_cs m where lower(m.email) = lower(auth.jwt() ->> 'email') and m.role = 'tresorier' and m.actif);
$tresorier$;

create or replace function current_membre_id()
returns uuid language sql stable security definer set search_path = public as $current_membre$
  select m.id from membres_cs m where lower(m.email) = lower(auth.jwt() ->> 'email') limit 1;
$current_membre$;

-- Email membre TOUJOURS canonique (lower + trim) à l'écriture (migration 018).
-- La casse a cassé la RLS en prod (incident 2026-07-19) : « Marc@… » en base ne
-- matchait plus l'email Auth « marc@… », donc current_membre_id() renvoyait null
-- et toute écriture liée à l'identité (vote, Q/R) était rejetée. Les helpers
-- ci-dessus comparent désormais en lower() ; ce trigger garantit en plus que la
-- table ne stocke jamais d'email non canonique, quel que soit le client.
create or replace function membres_cs_normalize_email()
returns trigger language plpgsql set search_path = public as $normalize_email$
begin
  if new.email is not null then
    new.email := lower(trim(new.email));
  end if;
  return new;
end;
$normalize_email$;

drop trigger if exists trg_membres_cs_normalize_email on membres_cs;
create trigger trg_membres_cs_normalize_email
  before insert or update of email on membres_cs
  for each row execute function membres_cs_normalize_email();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table comptes_ag              enable row level security;
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

-- Suppression : une décision enregistrée est au registre légal, elle n'est plus
-- effaçable — par personne, président compris. `write_admin` (for all) couvrant
-- le DELETE sans garde, et les policies permissives se cumulant en OU, seule une
-- policy RESTRICTIVE (combinée en ET) peut fermer ce chemin. Le reste de la règle
-- (président seul, au plus 1 vote) est applicatif : cf. DecisionDetail.canDelete.
drop policy if exists "decisions_no_delete_enregistree" on decisions;
create policy "decisions_no_delete_enregistree" on decisions
  as restrictive for delete to authenticated
  using (enregistree = false);

-- Projets : le chef de projet modifie son projet (migration 013). Un membre crée
-- un projet dont il est le chef ; le chef modifie. Le président (write_admin)
-- crée/assigne/supprime. La permission s'ancre sur chef_projet_id — un created_by
-- (= le créateur) empêcherait un chef désigné par le président de modifier.
drop policy if exists "projets_chef_insert" on projets;
create policy "projets_chef_insert" on projets for insert to authenticated
  with check (
    chef_projet_id = current_membre_id()
    and exists (select 1 from membres_cs m where m.id = current_membre_id() and m.actif)
  );

drop policy if exists "projets_chef_update" on projets;
create policy "projets_chef_update" on projets for update to authenticated
  using (chef_projet_id = current_membre_id())
  with check (chef_projet_id = current_membre_id());

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

-- Signatures : le secrétaire peut faire signer, comme le président (migration
-- 015). INSERT (créer un lot) + UPDATE (marquer signé) ; pas de DELETE. Le
-- président garde tout via write_admin (permissives cumulées en OU).
drop policy if exists "signature_batches_secretaire_insert" on signature_batches;
create policy "signature_batches_secretaire_insert" on signature_batches
  for insert to authenticated
  with check (is_secretaire());

drop policy if exists "signature_batches_secretaire_update" on signature_batches;
create policy "signature_batches_secretaire_update" on signature_batches
  for update to authenticated
  using (is_secretaire())
  with check (is_secretaire());

-- AG et résolutions : le secrétaire les gère aussi (migration 016). INSERT +
-- UPDATE ; pas de DELETE (suppression = président). Le président garde tout.
drop policy if exists "ag_secretaire_insert" on assemblees_generales;
create policy "ag_secretaire_insert" on assemblees_generales
  for insert to authenticated with check (is_secretaire());
drop policy if exists "ag_secretaire_update" on assemblees_generales;
create policy "ag_secretaire_update" on assemblees_generales
  for update to authenticated using (is_secretaire()) with check (is_secretaire());
drop policy if exists "resolutions_secretaire_insert" on resolutions_ag;
create policy "resolutions_secretaire_insert" on resolutions_ag
  for insert to authenticated with check (is_secretaire());
drop policy if exists "resolutions_secretaire_update" on resolutions_ag;
create policy "resolutions_secretaire_update" on resolutions_ag
  for update to authenticated using (is_secretaire()) with check (is_secretaire());

-- Comptes AGO (migration 017) : co-validation trésorier + président. Chacun pose
-- et retire SA ligne (approuve_par = lui) ; personne n'approuve pour l'autre rôle.
drop policy if exists "comptes_ag_read" on comptes_ag;
create policy "comptes_ag_read" on comptes_ag for select to authenticated using (true);
drop policy if exists "comptes_ag_tresorier_insert" on comptes_ag;
create policy "comptes_ag_tresorier_insert" on comptes_ag for insert to authenticated
  with check (is_tresorier() and role = 'tresorier' and approuve_par = current_membre_id());
drop policy if exists "comptes_ag_president_insert" on comptes_ag;
create policy "comptes_ag_president_insert" on comptes_ag for insert to authenticated
  with check (is_admin() and role = 'president' and approuve_par = current_membre_id());
drop policy if exists "comptes_ag_tresorier_delete" on comptes_ag;
create policy "comptes_ag_tresorier_delete" on comptes_ag for delete to authenticated
  using (is_tresorier() and role = 'tresorier');
drop policy if exists "comptes_ag_president_delete" on comptes_ag;
create policy "comptes_ag_president_delete" on comptes_ag for delete to authenticated
  using (is_admin() and role = 'president');

-- =============================================================================
-- Storage — bucket privé `documents` (voir migration 012 pour le raisonnement)
--
-- Les pièces jointes vivent dans le bucket ; `documents[]` ne garde que
-- {path,name,type,size}. On stocke un CHEMIN, pas une URL : le bucket est privé,
-- l'accès passe par une URL signée à durée courte, et un registre légal se relit
-- dix ans plus tard.
--
-- Convention de chemin PORTEUSE — les policies en dépendent :
--     decisions/<decision_id>/<uuid>.<ext>
--     projets/<projet_id>/<uuid>.<ext>
-- L'id dans le chemin est ce qui permet de refuser la suppression d'un fichier
-- attaché à une décision enregistrée (verrou de l'art. 15).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 26214400)
on conflict (id) do update
  set public = false,
      file_size_limit = 26214400;

-- Tout membre connecté lit tout — même règle que `read_auth` sur les tables.
drop policy if exists "documents_read_auth" on storage.objects;
create policy "documents_read_auth" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents');

-- Membre actif, jamais sur une décision enregistrée. `d.id::text` comparé au
-- segment de chemin, et pas l'inverse : caster un chemin quelconque en uuid
-- lèverait une erreur au lieu de renvoyer faux.
drop policy if exists "documents_insert_membre" on storage.objects;
create policy "documents_insert_membre" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and exists (
      select 1 from public.membres_cs m
      where m.id = public.current_membre_id() and m.actif
    )
    and not exists (
      select 1 from public.decisions d
      where d.id::text = (storage.foldername(name))[2]
        and d.enregistree
    )
  );

-- Pas de policy UPDATE, volontairement : chaque fichier est écrit sous un uuid
-- neuf. Sans policy, l'écrasement est impossible.

-- Président, ou owner de la décision — jamais sur une décision enregistrée.
drop policy if exists "documents_delete" on storage.objects;
create policy "documents_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and not exists (
      select 1 from public.decisions d
      where d.id::text = (storage.foldername(name))[2]
        and d.enregistree
    )
    and (
      public.is_admin()
      or exists (
        select 1 from public.decisions d
        where d.id::text = (storage.foldername(name))[2]
          and d.created_by = public.current_membre_id()
      )
    )
  );

-- =============================================================================
-- NOTE Auth : créer les comptes (Authentication > Users) avec le MÊME email
-- que membres_cs. Pas d'auto-inscription (spec §4.1).
-- =============================================================================
