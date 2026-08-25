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
  heure_planifiee  text,                                  -- « HH:MM » prévue à la convocation (migration 022)
  heure_fin        text,                                  -- « HH:MM » effective de fin de séance, à la clôture
  lieu             text,
  president_seance text,                                  -- désigné EN séance : inconnu à la planification
  ordre_du_jour    text,
  -- Cycle : preparation → convoquee → (a eu lieu : DÉRIVÉ de la date, non stocké) → cloturee. + annulee (migration 023).
  statut           text not null default 'preparation' check (statut in ('preparation','convoquee','cloturee','annulee')),
  -- A posteriori (une fois l'AG tenue) : résultat de quorum + m² présents/représentés (migration 023).
  quorum_statut    text check (quorum_statut in ('quorum_atteint','sans_quorum_accepte','sans_quorum_rejete')),
  m2_presents      numeric(10,2),
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
  statut           text default 'a_voter' check (statut in ('a_voter','adoptee','rejetee','retiree','sans_vote')),
  budget_alloue    numeric(12,2),
  budget_intitule  text,
  observations     text,
  documents        jsonb not null default '[]',           -- pièces jointes {path,name,type,size} (migration 025)
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
--
-- DEUX axes distincts, à ne jamais confondre (migration 026) :
--   - `phase`  = où en est la décision dans son CYCLE : brouillon → planifiee →
--                ouverte_au_vote (+ annulee, avant ouverture du vote).
--   - `statut` = RÉSULTAT de la délibération : 'en_cours' puis, à
--                l'enregistrement, 'adoptee' | 'rejetee' (art. 15, `tally`).
-- Les budgets, le CSV Foncia et le PDF lisent `statut` ; ils ne connaissent pas
-- le cycle de vie. C'est pour cela que la spec « brouillon / planifiée », qui
-- fusionnait les deux dans une seule colonne, a été décomposée en deux ici.
create table if not exists decisions (
  id                   uuid primary key default gen_random_uuid(),
  numero               text not null unique,             -- AAAA-NNN
  titre                text not null,
  description          text not null,
  date_publication     date not null,                    -- postée le ; REPOSÉE au jour de l'ouverture réelle si la décision était planifiée
  date_limite_reponse  date,                              -- défaut = + delai_vote_jours jours ouvrables
  date_enregistrement  date,                              -- actée par le président
  date_notification    timestamptz,                       -- dernier partage au CS (null = jamais notifiée)
  phase                text not null default 'ouverte_au_vote' check (phase in ('brouillon','planifiee','ouverte_au_vote','annulee')),
  date_soumission_prevue timestamptz,                     -- ouverture PRÉVUE du vote (planification)
  soumise_le           timestamptz,                       -- ouverture RÉELLE du vote
  version              integer not null default 1,        -- incrémenté à chaque modification du brouillon
  contenu_gele         text,                              -- titre + "\n\n" + description, figé à l'ouverture du vote
  hash_contenu         text,                              -- SHA-256 hex de contenu_gele (UTF-8) — valeur probante
  visibilite           text not null default 'cs_seul' check (visibilite in ('cs_seul','colotis')),  -- ⚠ aucun lecteur : registre colotis hors périmètre v1
  delai_vote_jours     integer not null default 7,        -- durée d'ouverture du vote, en jours OUVRÉS
  motif_annulation     text,                              -- obligatoire si phase = 'annulee'
  statut               text not null default 'en_cours' check (statut in ('en_cours','adoptee','rejetee')),
  enregistree          boolean not null default false,   -- verrou : non modifiable si true
  quorum_atteint       boolean,
  composition_snapshot jsonb,
  montant_engage       numeric(12,2),                    -- engagement (sur projet OU résolution), le devis tel quel
  tva_taux             numeric(5,2),                     -- taux TVA saisi (0/5.5/10/20…) — migration 024
  tva_incluse          boolean,                          -- le montant inclut-il la TVA (TTC) ou non (HT) ? TTC = calculé
  projet_id            uuid references projets(id) on delete set null,               -- engagement via projet
  ag_id                uuid references assemblees_generales(id) on delete set null,  -- rattachement AG
  resolution_id        uuid references resolutions_ag(id) on delete set null,        -- engagement direct résolution
  projet_action        text check (projet_action in ('suspendre','reprendre','terminer')),  -- effet sur le statut du projet, appliqué une fois enregistrée ET adoptée
  documents            jsonb not null default '[]',      -- pièces jointes [{id,name,type,size,dataUrl}]
  created_by           uuid references membres_cs(id),   -- owner = membre créateur (id membres_cs) ; « auteur » du brouillon au sens de la spec
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Une décision ENREGISTRÉE a forcément été soumise au vote : on n'acte au
  -- registre ni un brouillon, ni une décision planifiée, ni une annulée.
  constraint decisions_enregistree_phase_check check (enregistree = false or phase = 'ouverte_au_vote')
);

create index if not exists decisions_phase_idx on decisions (phase);
create index if not exists decisions_soumission_prevue_idx
  on decisions (date_soumission_prevue) where phase = 'planifiee';

-- --------------------------------------------------- decisions_historique (026)
-- Une ligne par modification du texte d'un BROUILLON : montre que le texte soumis
-- au vote est bien celui qui a été préparé, et par qui. Écrite uniquement par le
-- trigger `decisions_cycle_guard` (security definer) — aucune policy d'écriture,
-- donc un historique non réécrivable depuis le client.
create table if not exists decisions_historique (
  id          uuid primary key default gen_random_uuid(),
  decision_id uuid not null references decisions(id) on delete cascade,
  version     integer not null,
  titre       text not null,
  contenu     text not null,
  modifie_par uuid references membres_cs(id),
  modifie_le  timestamptz not null default now(),
  unique (decision_id, version)
);

-- ------------------------------------------------------------- cron_runs (026)
-- Journal des exécutions de l'ouverture automatique des décisions planifiées.
-- `source` : 'cron' (pg_cron) ou 'app' (filet applicatif). Seules les exécutions
-- ayant réellement ouvert quelque chose sont journalisées — le filet tourne à
-- chaque chargement de l'app, tracer les passages à vide noierait le journal.
create table if not exists cron_runs (
  id         uuid primary key default gen_random_uuid(),
  tache      text not null,
  source     text not null,
  traitees   integer not null default 0,
  detail     text,
  execute_le timestamptz not null default now()
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
-- Cycle de vie des décisions : brouillon → planifiée → ouverte au vote
-- (migration 026 — voir ce fichier pour le raisonnement complet)
-- =============================================================================

-- N jours OUVRÉS après une date (samedi/dimanche sautés). Réplique exacte de
-- `addBusinessDaysISO` côté app : la date limite de réponse doit tomber le même
-- jour, que ce soit le formulaire ou l'ouverture automatique qui la calcule.
create or replace function jours_ouvres_apres(p_date date, p_n integer)
returns date language plpgsql immutable set search_path = public as $$
declare
  d date := p_date;
  i integer := 0;
begin
  while i < p_n loop
    d := d + 1;
    while extract(isodow from d) >= 6 loop
      d := d + 1;
    end loop;
    i := i + 1;
  end loop;
  return d;
end $$;

-- LE point unique où le cycle est appliqué : formulaire, ouverture automatique
-- ou correction à la main passent tous par ici. Le gel du texte et son empreinte
-- sont la valeur probante de la délibération — ils ne peuvent pas dépendre du
-- chemin emprunté pour écrire la ligne.
create or replace function decisions_cycle_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_maj    boolean;
  v_change boolean := false;
  v_texte  text;
begin
  -- ⚠ FORME CONTRAINTE PAR L'ÉDITEUR SQL DE SUPABASE, pas par le goût.
  -- Son analyseur maison a refusé cinq variantes de cette fonction avant
  -- celle-ci (2026-08-25). Interdits, sous peine de rejet AVANT Postgres :
  --   - toute chaine vide, qu'il prend pour une apostrophe échappée
  --     (d'ou `coalesce(length(btrim(x)), 0) = 0` et `concat(x)`) ;
  --   - toute apostrophe échappée dans un message ;
  --   - tout argument de formatage de `raise` — `to_char(x, 'DD/MM/YYYY')`
  --     et les `%` l'ont fait décrocher. Les messages sont donc NUS.
  -- Cousin du piège des balises `$$` de la migration 018. Ne pas « simplifier ».
  v_maj := tg_op = 'UPDATE';

  if v_maj then
    v_change := new.titre is distinct from old.titre or new.description is distinct from old.description;
  end if;

  -- 1. Transitions autorisées : une délibération soumise ne se dé-soumet pas,
  --    et une décision annulée reste au registre avec son motif.
  if v_maj and new.phase is distinct from old.phase then
    if not (
      (old.phase = 'brouillon' and new.phase in ('planifiee','ouverte_au_vote','annulee'))
      or (old.phase = 'planifiee' and new.phase in ('brouillon','ouverte_au_vote','annulee'))
    ) then
      raise exception 'Transition de phase interdite : une délibération déjà soumise au vote, ou annulée, ne revient pas en arrière.';
    end if;
  end if;

  -- 2. Annulation : motif OBLIGATOIRE. Rien ne disparaît du registre, donc une
  --    décision retirée doit dire pourquoi.
  if new.phase = 'annulee' and coalesce(length(btrim(new.motif_annulation)), 0) = 0 then
    raise exception 'Annulation impossible sans motif : le registre doit dire pourquoi la décision a été retirée.';
  end if;

  -- 3. GEL DU TEXTE. Une fois le vote ouvert, on ne réécrit plus ce sur quoi les
  --    membres votent. La garde porte sur `contenu_gele is not null` et NON sur
  --    la phase, pour ne pas geler rétroactivement les décisions antérieures à
  --    la 026. Pièces jointes, montant et rattachement restent modifiables
  --    jusqu'à l'enregistrement : ce n'est pas « le texte » (un devis arrive
  --    souvent après l'ouverture du vote).
  if v_maj and v_change and old.contenu_gele is not null then
    raise exception 'Texte gelé : la délibération soumise au vote ne peut plus être modifiée.';
  end if;

  -- 4. Historique + version, tant que la décision est un brouillon (planifiée
  --    incluse : c'est un brouillon daté).
  if v_maj and v_change and old.phase in ('brouillon','planifiee') then
    new.version := old.version + 1;
    insert into decisions_historique (decision_id, version, titre, contenu, modifie_par)
      values (new.id, new.version, new.titre, concat(new.description), current_membre_id());
  end if;

  -- 5. OUVERTURE DU VOTE : gel, empreinte, RECALAGE DES DATES.
  --    `date_publication` détermine la COMPOSITION du CS appelée à voter
  --    (`activeMembersAt`) et le dénominateur du quorum : une décision rédigée en
  --    août et ouverte le 16 septembre doit revenir au conseil désigné le 15, pas
  --    à l'ancien. D'où le recalage au jour d'ouverture RÉELLE (heure de Paris —
  --    `now()` est en UTC), + délai en jours ouvrés.
  if new.phase = 'ouverte_au_vote' and new.contenu_gele is null then
    new.soumise_le := coalesce(new.soumise_le, now());
    v_texte := concat(new.titre, chr(10), chr(10), new.description);
    new.contenu_gele := v_texte;
    new.hash_contenu := encode(sha256(convert_to(v_texte, 'UTF8')), 'hex');
    if v_maj and old.phase in ('brouillon','planifiee') then
      new.date_publication := (new.soumise_le at time zone 'Europe/Paris')::date;
      new.date_limite_reponse := jours_ouvres_apres(new.date_publication, new.delai_vote_jours);
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_decisions_cycle_guard on decisions;
create trigger trg_decisions_cycle_guard
  before insert or update on decisions
  for each row execute function decisions_cycle_guard();

-- Trace d'audit du changement de VISIBILITÉ (migration 027). Un trigger, et pas
-- un insert côté application : il attrape tous les chemins (carte du président
-- sur une décision enregistrée, formulaire du rédacteur sur un brouillon), et
-- `audit_log` n'étant écrivable que par `write_admin`, un insert côté client
-- aurait échoué pour un rédacteur non président — donc perdu la trace en
-- silence. C'est le premier écrit dans `audit_log` côté Supabase : jusqu'ici
-- seul le mode démo l'alimentait. Portée étroite à dessein : la seule
-- visibilité. Auditer toute la table est un autre chantier.
create or replace function decisions_audit_visibilite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.visibilite is distinct from old.visibilite then
    insert into audit_log (entite, entite_id, action, acteur, details)
      values (
        'decisions',
        new.id,
        'visibilite',
        current_membre_id(),
        concat('Décision ', new.numero, ' — visibilité ', old.visibilite, ' vers ', new.visibilite)
      );
  end if;
  return null;
end $$;

drop trigger if exists trg_decisions_audit_visibilite on decisions;
create trigger trg_decisions_audit_visibilite
  after update on decisions
  for each row execute function decisions_audit_visibilite();

-- Ouverture automatique des décisions planifiées échues. STRICTEMENT idempotente
-- (`where phase = 'planifiee'`). Deux déclencheurs, même fonction :
--   1. pg_cron, toutes les heures (voir la migration 026 pour la planification) ;
--   2. filet applicatif : l'app l'appelle au chargement (`useOuvertureAutomatique`),
--      pour qu'un pg_cron non activé ne fasse pas qu'une décision planifiée ne
--      s'ouvre JAMAIS, en silence.
-- `security definer` : le cron n'a pas de JWT, et le filet peut être déclenché
-- par un membre qui n'est pas l'auteur. La fonction n'applique qu'une échéance
-- déjà fixée par l'auteur — elle n'ouvre rien qui ne soit ni planifié, ni échu.
create or replace function ouvrir_decisions_planifiees(p_source text default 'app')
returns integer language plpgsql security definer set search_path = public as $ouvrir_dues$
declare
  v_numeros text[];
  v_n       integer;
begin
  with dues as (
    update decisions
       set phase = 'ouverte_au_vote'
     where phase = 'planifiee'
       and date_soumission_prevue is not null
       and date_soumission_prevue <= now()
    returning numero
  )
  select array_agg(numero), count(*) into v_numeros, v_n from dues;

  v_n := coalesce(v_n, 0);
  if v_n > 0 then
    insert into cron_runs (tache, source, traitees, detail)
      values ('ouvrir_decisions_planifiees', p_source, v_n, array_to_string(v_numeros, ', '));
  end if;
  return v_n;
end;
$ouvrir_dues$;

revoke all on function ouvrir_decisions_planifiees(text) from public;
grant execute on function ouvrir_decisions_planifiees(text) to authenticated;

-- Numéro AAAA-NNN suivant. `security definer`, et c'est OBLIGATOIRE : le calcul
-- « max + 1 de l'année » se faisait côté client sur `listDecisions()`, ce qui ne
-- marche que si tout le monde voit tout. Les brouillons étant privés (policy
-- `decisions_avant_soumission_privee`), un membre ne voit plus le brouillon
-- 2026-007 d'un autre — il tirerait le même numéro et l'insert échouerait sur
-- l'unique, avec une erreur Postgres illisible.
--
-- Le numéro n'est pas « réservé » pour autant : deux créations simultanées
-- peuvent encore tomber sur le même (c'était déjà le cas). L'unique en base
-- reste le garde-fou.
create or replace function prochain_numero_decision(p_annee integer)
returns text language sql stable security definer set search_path = public as $numero$
  select p_annee || '-' || lpad((coalesce(max(seq), 0) + 1)::text, 3, '0')
  from (
    select case when substring(numero from 6) ~ '^[0-9]+$' then substring(numero from 6)::integer end as seq
      from decisions
     where numero like p_annee || '-%'
  ) t;
$numero$;

revoke all on function prochain_numero_decision(integer) from public;
grant execute on function prochain_numero_decision(integer) to authenticated;

-- ⚠ Le PLANIFICATEUR n'est pas ici. Sur une base neuve, il faut encore poser la
-- tâche pg_cron qui appelle `ouvrir_decisions_planifiees` toutes les heures —
-- voir la fin de la migration 026. Sans elle, une décision planifiée ne s'ouvre
-- qu'au prochain chargement de l'app par un membre (filet applicatif), pas à
-- l'heure dite. C'est silencieux : rien dans l'app ne signale son absence.

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
alter table decisions_historique    enable row level security;
alter table cron_runs               enable row level security;
alter table audit_log               enable row level security;

-- Lecture générale (authentifiés)
do $$
declare t text;
begin
  foreach t in array array[
    'membres_cs','assemblees_generales','resolutions_ag','projets','decisions','votes',
    'questions_reponses','signature_batches','decision_status_history','audit_log',
    -- decisions_historique / cron_runs : lecture seule pour tous les membres, et
    -- AUCUNE policy d'écriture — elles ne sont écrites que par les fonctions
    -- `security definer` de la migration 026. Un historique de brouillon
    -- réécrivable depuis le client ne prouverait rien. (L'historique est ensuite
    -- restreint à la visibilité de SA décision, cf. `historique_suit_la_decision`.)
    'decisions_historique','cron_runs'
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

-- UN BROUILLON N'APPARTIENT QU'À SON AUTEUR (migration 026, arbitrage Pascal
-- 2026-08-25). Tant qu'une décision est en brouillon — planifiée comprise, c'est
-- un brouillon daté — elle n'existe que pour son auteur : **le président n'y a
-- aucun droit de plus qu'un autre membre**. Il ne la voit pas, ne la modifie
-- pas, ne la soumet pas au vote, ne la supprime pas.
--
-- Pourquoi le président n'y échappe pas : demander une décision au conseil n'est
-- pas un pouvoir présidentiel. Tout membre actif rédige et soumet les siennes
-- (modèle de propriété, migration 006) ; le président n'a de prérogative propre
-- que sur l'ACTE — enregistrer une délibération votée — et sur la signature. Lui
-- donner la vue et la main sur les brouillons des autres serait un droit de
-- regard, voire de soumission forcée, sur ce qu'un membre a le droit de proposer.
--
-- Dès que la décision quitte le brouillon, elle est visible de TOUS, annulée
-- comprise : annuler est l'acte délibéré de laisser une trace au registre (motif
-- obligatoire). Qui ne veut pas de trace SUPPRIME.
--
-- TROIS policies restrictives, et il en faut bien trois : `read_auth` et
-- `write_admin` sont des `using (true)` / `using (is_admin())`, les permissives
-- se cumulent en OU. Surtout, chaque verbe se ferme séparément — un SELECT fermé
-- n'empêche NI l'UPDATE NI le DELETE d'une ligne qu'on ne voit pas (PostgreSQL
-- n'exige aucun droit de lecture pour écrire une ligne ciblée par son id).
--
-- ⚠ Les sous-requêtes des autres policies qui lisent `decisions`
-- (votes_self_write, qa_self_insert, documents_*) subissent cette RLS et ne
-- verront rien pour le brouillon d'autrui. Sans effet aujourd'hui, mais toute
-- nouvelle policy interrogeant `decisions` doit en tenir compte.
-- ⚠ Effet de bord assumé : le brouillon d'un membre devenu inactif n'est plus
-- accessible à personne.
drop policy if exists "decisions_avant_soumission_privee" on decisions;
create policy "decisions_avant_soumission_privee" on decisions
  as restrictive for select to authenticated
  using (phase not in ('brouillon','planifiee') or created_by = current_membre_id());

-- Sans celle-ci, `write_admin` laissait le président réécrire le texte d'un
-- brouillon qu'il ne voit pas, ou le passer en `ouverte_au_vote` — soumettre au
-- conseil la décision d'un autre, à sa place. Le `with check` autorise la sortie
-- de brouillon par son auteur : la ligne NEW n'est alors plus un brouillon.
drop policy if exists "decisions_brouillon_update_auteur" on decisions;
-- `with check` OMIS volontairement : pour une policy UPDATE, PostgreSQL réutilise
-- l'expression `using` comme `with check` quand celle-ci est absente. Les deux
-- étaient identiques ici — et l'éditeur SQL de Supabase a refusé la forme longue.
create policy "decisions_brouillon_update_auteur" on decisions
  as restrictive for update to authenticated
  using (phase not in ('brouillon','planifiee') or created_by = current_membre_id());

drop policy if exists "decisions_brouillon_delete_auteur" on decisions;
create policy "decisions_brouillon_delete_auteur" on decisions
  as restrictive for delete to authenticated
  using (phase not in ('brouillon','planifiee') or created_by = current_membre_id());

-- L'AUTEUR SUPPRIME SON PROPRE BROUILLON (permissive : elle ouvre le droit).
-- Une décision jamais soumise n'est pas une délibération : rien ne s'est passé
-- juridiquement, rien n'a à rester. Le principe « rien ne disparaît du registre »
-- protège les délibérations, pas les brouillons. Sans elle, l'auteur devait
-- demander au président ou « annuler » — ce qui gare pour toujours au registre
-- une décision annulée, motif à l'appui, pour une erreur de saisie. Bornée à
-- `brouillon` / `planifiee` : dès que le vote est ouvert, l'auteur ne supprime
-- plus (le président le peut encore tant que ce n'est pas enregistré).
drop policy if exists "decisions_owner_delete" on decisions;
create policy "decisions_owner_delete" on decisions for delete to authenticated
  using (
    created_by = current_membre_id()
    and enregistree = false
    and phase in ('brouillon','planifiee')
  );

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

-- On ne vote QUE sur une décision ouverte au vote — jamais sur un brouillon, une
-- décision planifiée ou annulée (migration 026). Policies RESTRICTIVES (combinées
-- en ET) : `votes_admin` étant un `for all using (is_admin())` et les policies
-- permissives se cumulant en OU, une garde permissive de plus laisserait le
-- président voter sur un brouillon.
--
-- Portée INSERT + UPDATE seulement : un `for all` aurait aussi filtré le SELECT,
-- donc masqué les votes de toutes les décisions enregistrées — c'est-à-dire tout
-- le registre. Le DELETE reste ouvert (retirer un vote = rendre le membre
-- absent), déjà borné par `votes_self_write` (décision non enregistrée).
drop policy if exists "votes_open_only_insert" on votes;
create policy "votes_open_only_insert" on votes as restrictive for insert to authenticated
  with check (exists (select 1 from decisions d where d.id = decision_id and d.phase = 'ouverte_au_vote'));

drop policy if exists "votes_open_only_update" on votes;
create policy "votes_open_only_update" on votes as restrictive for update to authenticated
  using (exists (select 1 from decisions d where d.id = decision_id and d.phase = 'ouverte_au_vote'));

-- L'historique d'un brouillon SUIT la visibilité de sa décision : sans ça, le
-- texte d'un brouillon privé serait lisible de tous dans `decisions_historique`
-- — exactement ce que la policy ci-dessus vient de cacher. La sous-requête est
-- soumise à la RLS de `decisions`, donc elle ne renvoie rien pour le brouillon
-- d'autrui, et l'historique disparaît avec lui.
drop policy if exists "historique_suit_la_decision" on decisions_historique;
create policy "historique_suit_la_decision" on decisions_historique
  as restrictive for select to authenticated
  using (exists (select 1 from decisions d where d.id = decision_id));

-- Q&A : admin tout ; membre peut ajouter (auteur = lui-même).
drop policy if exists "qa_admin" on questions_reponses;
create policy "qa_admin" on questions_reponses for all to authenticated using (is_admin()) with check (is_admin());

-- Insert Q/R/commentaire : par soi-même ET seulement si la décision n'est pas
-- enregistrée (registre figé — aligné sur votes_self_write, migration 021).
drop policy if exists "qa_self_insert" on questions_reponses;
create policy "qa_self_insert" on questions_reponses for insert to authenticated
  with check (
    auteur_id = current_membre_id()
    and exists (select 1 from decisions d where d.id = decision_id and d.enregistree = false)
  );

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

-- …AVEC la même exception que les tables : les pièces jointes d'un brouillon
-- suivent la visibilité de leur décision (migration 026). Sans cette garde, le
-- devis attaché à un brouillon privé restait lisible de tous — pas exploitable
-- en pratique (le chemin se lit sur la ligne, justement cachée), mais une
-- confidentialité qui repose sur « il ne connaît pas l'URL » n'en est pas une.
--
-- RESTRICTIVE et ADDITIVE : on ne réécrit pas `documents_read_auth` ci-dessus,
-- pour qu'un échec de déploiement ne puisse jamais laisser le bucket sans
-- policy de lecture. La convention `decisions/<id>/…` porte l'id ; la
-- sous-requête subit la RLS de `decisions` et ne renvoie rien pour le brouillon
-- d'autrui. Le premier segment est testé d'abord : un chemin `projets/…`,
-- `resolutions/…` ou hérité n'est pas concerné (ce qui couvre au passage les
-- autres buckets éventuels — une restrictive sur storage.objects vaut pour tous).
drop policy if exists "documents_brouillon_prive" on storage.objects;
create policy "documents_brouillon_prive" on storage.objects
  as restrictive for select to authenticated
  using (
    (storage.foldername(name))[1] is distinct from 'decisions'
    or exists (
      select 1 from public.decisions d
      where d.id::text = (storage.foldername(name))[2]
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
