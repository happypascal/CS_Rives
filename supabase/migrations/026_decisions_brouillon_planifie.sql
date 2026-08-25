-- =============================================================================
-- Migration 026 — décisions en BROUILLON avec soumission PLANIFIÉE
-- (spec « Spec_Decisions_Brouillon_Planifie.md », v1 — août 2026)
--
-- Besoin déclencheur : une règle rédigée aujourd'hui doit être soumise au vote
-- du CS APRÈS l'AG du 15 septembre 2026, comme premier acte du conseil
-- nouvellement désigné. D'où : on rédige à l'avance, on fixe la date, le système
-- ouvre le vote tout seul.
--
-- Principe directeur de la spec, non négociable : **la planification OUVRE le
-- vote, elle ne l'emporte jamais.** Rien ici n'adopte, ne rejette ni n'enregistre
-- quoi que ce soit — l'acte reste celui du président (art. 15).
--
-- -----------------------------------------------------------------------------
-- ÉCART ASSUMÉ vs la spec §2.1 : la spec fusionne tout dans une colonne `statut`
-- (brouillon / planifiee / ouverte_au_vote / adoptee / rejetee / annulee).
-- ICI ON N'Y TOUCHE PAS, et c'est délibéré : `decisions.statut` porte déjà le
-- RÉSULTAT de la délibération ('en_cours' → 'adoptee' | 'rejetee'), il est
-- calculé par `tally()` (art. 15), figé à l'enregistrement, et surtout LU par la
-- dérivation des budgets (`d.enregistree and d.statut = 'adoptee'` dans
-- computeAGBudgets / computeProjectBudgets), par le CSV Foncia et par le PDF.
-- Y injecter des états de cycle de vie ferait, en silence, qu'un brouillon ne
-- serait plus « ni adopté ni rejeté » mais un statut inconnu de tous ces
-- calculs. On ajoute donc une colonne SÉPARÉE `phase` pour l'avant-vote, et les
-- deux se lisent ensemble :
--
--     phase = 'brouillon' | 'planifiee'      → pas encore soumise, statut ignoré
--     phase = 'ouverte_au_vote'              → le cycle actuel de l'app reprend :
--                                              statut 'en_cours' puis, à
--                                              l'enregistrement, adoptee/rejetee
--     phase = 'annulee'                      → retirée AVANT ouverture du vote
--
-- -----------------------------------------------------------------------------
-- NON IMPLÉMENTÉ ICI, ET POURQUOI :
--   - `notifications_decision` (spec §2.3) et les relances e-mail (spec §6) :
--     le projet n'a AUCUN envoyeur (pas d'Edge Function, pas de domaine vérifié
--     — cf. le backlog « notifications automatiques par email, APRÈS l'AG » dans
--     docs/ETAT_COURANT.md). Une table que rien n'écrit est du schéma mort qui
--     laisse croire que les relances existent. À créer avec l'envoyeur.
--   - `cloturee_le` (spec §2.1) et la clôture automatique du vote (spec §6) :
--     clôturer, c'est calculer le résultat et le figer — or c'est exactement
--     l'ACTE du président (`enregistree`, `date_enregistrement`), et la spec
--     elle-même interdit qu'une échéance emporte une décision. Une colonne de
--     plus pour la même chose ferait diverger les deux.
-- =============================================================================

-- --------------------------------------------------------------------- colonnes
alter table decisions add column if not exists phase text not null default 'ouverte_au_vote';
alter table decisions drop constraint if exists decisions_phase_check;
alter table decisions add constraint decisions_phase_check
  check (phase in ('brouillon','planifiee','ouverte_au_vote','annulee'));

-- Défaut 'ouverte_au_vote' à DESSEIN : les décisions déjà en base sont, par
-- définition, déjà soumises au vote (ou enregistrées). Un défaut 'brouillon'
-- aurait rétroactivement dé-soumis tout le registre.

-- Date/heure d'ouverture PRÉVUE (ce que l'auteur planifie) vs date/heure RÉELLE
-- d'ouverture (ce que le système a fait). Les deux, jamais l'une pour l'autre :
-- sur un registre légal, « prévu » et « advenu » ne se confondent pas.
alter table decisions add column if not exists date_soumission_prevue timestamptz;
alter table decisions add column if not exists soumise_le             timestamptz;

-- Versionnement du brouillon (spec §2.2). Incrémenté par le trigger ci-dessous.
alter table decisions add column if not exists version integer not null default 1;

-- Gel du texte à l'ouverture du vote + son empreinte, pour la valeur probante.
-- `contenu_gele` = titre + "\n\n" + description, tel quel. `hash_contenu` =
-- SHA-256 hexadécimal de cette chaîne encodée en UTF-8. Recette reproductible
-- volontairement triviale : on doit pouvoir la refaire à la main dans dix ans.
alter table decisions add column if not exists contenu_gele text;
alter table decisions add column if not exists hash_contenu text;

-- Visibilité prévue de la décision. ⚠ AUCUN LECTEUR AUJOURD'HUI : le registre
-- consultable par les colotis est hors périmètre v1 (spec §9). La colonne
-- enregistre l'intention prise à la rédaction pour ne pas avoir à la redemander
-- rétroactivement le jour où cet accès existera. Ne pas la câbler à un filtre
-- de lecture sans avoir écrit les policies correspondantes.
alter table decisions add column if not exists visibilite text not null default 'cs_seul';
alter table decisions drop constraint if exists decisions_visibilite_check;
alter table decisions add constraint decisions_visibilite_check
  check (visibilite in ('cs_seul','colotis'));

-- Durée d'ouverture du vote, en JOURS OUVRÉS — pas en jours calendaires : c'est
-- déjà la règle de `date_limite_reponse` dans l'app (`addBusinessDaysISO`), et
-- deux règles de délai différentes dans le même registre seraient un piège.
alter table decisions add column if not exists delai_vote_jours integer not null default 7;

alter table decisions add column if not exists motif_annulation text;

-- Spec §4 : l'art. 15 est écrit pour des RÉUNIONS. Un vote asynchrone dans
-- l'app est une consultation écrite, que les statuts ne prévoient pas
-- expressément. Tant que le point n'est pas tranché (avec Me Garnier), on
-- enregistre et on AFFICHE la date de ratification en réunion. Champ posé par le
-- président APRÈS enregistrement : c'est un fait POSTÉRIEUR à la délibération,
-- pas une modification de celle-ci.
alter table decisions add column if not exists ratifiee_en_reunion_le date;

-- Une décision ENREGISTRÉE a forcément été soumise au vote. Contrainte
-- structurelle (et non un simple garde-fou d'écran) : elle interdit d'acter au
-- registre un brouillon, une décision planifiée ou une décision annulée.
alter table decisions drop constraint if exists decisions_enregistree_phase_check;
alter table decisions add constraint decisions_enregistree_phase_check
  check (enregistree = false or phase = 'ouverte_au_vote');

create index if not exists decisions_phase_idx on decisions (phase);
create index if not exists decisions_soumission_prevue_idx
  on decisions (date_soumission_prevue) where phase = 'planifiee';

-- --------------------------------------------------- decisions_historique (§2.2)
-- Une ligne par modification du texte d'un brouillon. Sert à montrer que le texte
-- soumis au vote est bien celui qui a été préparé, et par qui. Écrite UNIQUEMENT
-- par le trigger ci-dessous (security definer) : aucune policy d'écriture, donc
-- personne ne peut la réécrire depuis le client.
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

-- ------------------------------------------------------------- cron_runs (§5)
-- Journal des exécutions de l'ouverture automatique. `source` distingue le
-- planificateur ('cron') du filet applicatif ('app', cf. plus bas).
--
-- ⚠ On ne journalise QUE les exécutions ayant réellement ouvert quelque chose :
-- le filet applicatif tourne à chaque ouverture de l'app, et tracer les passages
-- à vide noierait les vraies lignes sous des milliers d'entrées inutiles.
create table if not exists cron_runs (
  id         uuid primary key default gen_random_uuid(),
  tache      text not null,
  source     text not null,
  traitees   integer not null default 0,
  detail     text,
  execute_le timestamptz not null default now()
);

-- =============================================================================
-- Helpers
-- =============================================================================

-- N jours OUVRÉS après une date (samedi/dimanche sautés). Réplique exacte de
-- `addBusinessDaysISO` (date-fns `addBusinessDays`) côté app : la date limite de
-- réponse doit tomber le même jour, que ce soit le formulaire ou l'ouverture
-- automatique qui la calcule. Les jours fériés ne sont PAS gérés — ils ne le
-- sont pas non plus côté app, et le délai n'est pas un délai de forclusion.
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

-- =============================================================================
-- Trigger de cycle de vie — LE point unique où le cycle est appliqué
--
-- Tout passe par ici : le formulaire, l'ouverture automatique, une correction à
-- la main dans le SQL Editor. C'est voulu — le gel du texte et son empreinte
-- sont la valeur probante de la décision, ils ne peuvent pas dépendre du chemin
-- emprunté pour écrire la ligne.
-- =============================================================================
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

-- =============================================================================
-- Ouverture automatique des décisions planifiées (spec §5)
--
-- ÉCART ASSUMÉ vs la spec : pas de Vercel Cron ni de route API. Le projet n'a
-- AUCUN code serveur (ni Edge Function, ni /api) — c'est un choix documenté — et
-- une route de cron exigerait d'exposer la SERVICE_ROLE_KEY (qui contourne
-- TOUTE la RLS) dans les variables Vercel, pour un registre légal. On fait donc
-- tourner le planificateur là où vivent déjà les données : pg_cron, dans la
-- base, sans clé qui sorte.
--
-- Deux déclencheurs, même fonction, strictement IDEMPOTENTE (le `where phase =
-- 'planifiee'` fait qu'une décision déjà ouverte n'est jamais retraitée) :
--   1. pg_cron, toutes les heures (voir le bloc en fin de fichier) ;
--   2. FILET APPLICATIF : l'app appelle cette fonction au chargement
--      (`useOuvertureAutomatique`). Sans ce filet, un pg_cron non activé ferait
--      qu'une décision planifiée ne s'ouvrirait JAMAIS — en silence. Sur un
--      registre légal, « la décision n'a jamais été soumise au vote » est le
--      pire des échecs : on préfère deux chemins redondants à un chemin muet.
--
-- `security definer` : le cron n'a pas de JWT, et le filet applicatif peut être
-- déclenché par n'importe quel membre connecté — or la décision à ouvrir
-- appartient à quelqu'un d'autre. La fonction ne fait qu'appliquer une échéance
-- déjà fixée par l'auteur : elle n'ouvre rien qui ne soit ni planifié, ni échu.
-- =============================================================================
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

-- =============================================================================
-- Numérotation — `security definer`, et c'est OBLIGATOIRE ici
--
-- Le numéro AAAA-NNN est « max + 1 de l'année ». Il se calculait côté client à
-- partir de `listDecisions()`, ce qui marchait tant que TOUT LE MONDE VOYAIT
-- TOUT. Les brouillons devenant privés (policy ci-dessous), un membre ne voit
-- plus le brouillon 2026-007 d'un autre : il tirerait 2026-007 à son tour et
-- l'insert échouerait sur `decisions_numero_key`, avec une erreur Postgres
-- illisible. La numérotation doit donc être calculée par une fonction qui, elle,
-- voit toutes les lignes.
--
-- Ça ne rend pas le numéro « réservé » : deux créations simultanées peuvent
-- toujours tomber sur le même (c'était déjà le cas). Le numéro reste attribué à
-- la création, l'unique en base reste le garde-fou.
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

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table decisions_historique enable row level security;
alter table cron_runs            enable row level security;

-- Lecture : comme partout, tout membre connecté lit tout.
drop policy if exists "read_auth" on decisions_historique;
create policy "read_auth" on decisions_historique for select to authenticated using (true);
drop policy if exists "read_auth" on cron_runs;
create policy "read_auth" on cron_runs for select to authenticated using (true);

-- Aucune policy d'écriture, volontairement : les deux tables ne sont écrites que
-- par les fonctions `security definer` ci-dessus. Un historique de brouillon
-- réécrivable depuis le client ne prouverait rien.

-- ==========================================================================
-- UN BROUILLON N'APPARTIENT QU'À SON AUTEUR (arbitrage Pascal 2026-08-25)
--
-- Règle en une phrase : **tant qu'une décision est en brouillon (planifiée
-- comprise : c'est un brouillon daté), elle n'existe que pour son auteur — le
-- président n'y a aucun droit de plus qu'un autre membre.** Il ne la voit pas,
-- ne la modifie pas, ne la soumet pas au vote, ne la supprime pas.
--
-- Pourquoi cette exception à « tout membre connecté lit tout », et pourquoi le
-- président n'y échappe pas : demander une décision au conseil n'est pas un
-- pouvoir présidentiel. **Tout membre actif rédige et soumet ses décisions**
-- (c'est déjà le modèle de propriété de la migration 006) ; le président n'a de
-- prérogative propre que sur l'ACTE — enregistrer la délibération une fois
-- votée — et sur la signature. Lui donner la vue et la main sur les brouillons
-- des autres reviendrait à lui donner un droit de regard, voire de soumission
-- forcée, sur ce qu'un membre a le droit de proposer.
--
-- Dès que la décision quitte le brouillon, elle est visible de TOUS, y compris
-- annulée : annuler est l'acte délibéré de laisser une trace au registre (motif
-- obligatoire). Qui ne veut pas de trace SUPPRIME. Les deux actions sont
-- distinctes exprès.
--
-- Trois policies RESTRICTIVES (combinées en ET), et il en faut bien trois :
-- `read_auth` et `write_admin` sont des `using (true)` / `using (is_admin())`,
-- et les policies permissives se cumulent en OU — une permissive de plus
-- n'aurait rien fermé du tout. Chaque verbe doit être fermé séparément : un
-- SELECT fermé n'empêche NI l'UPDATE NI le DELETE d'une ligne qu'on ne voit pas
-- (PostgreSQL n'exige pas de droit de lecture pour écrire une ligne ciblée par
-- son id).
--
-- ⚠ Conséquence à connaître : les sous-requêtes des AUTRES policies qui lisent
-- `decisions` (votes_self_write, qa_self_insert, documents_*) subissent cette
-- RLS et ne verront « pas de ligne » pour le brouillon d'autrui. Sans effet
-- aujourd'hui — aucune ne concerne une décision non soumise — mais toute
-- nouvelle policy interrogeant `decisions` doit en tenir compte.
--
-- ⚠ Effet de bord assumé : le brouillon d'un membre devenu inactif n'est plus
-- accessible à personne. C'est la contrepartie directe de la règle ; le sujet se
-- reprend en rédigeant une nouvelle décision, pas en fouillant ses brouillons.
-- ==========================================================================

-- 1. LECTURE
drop policy if exists "decisions_avant_soumission_privee" on decisions;
create policy "decisions_avant_soumission_privee" on decisions
  as restrictive for select to authenticated
  using (
    phase not in ('brouillon','planifiee')
    or created_by = current_membre_id()
  );

-- 2. ÉCRITURE — sans elle, le président pouvait, via `write_admin`, réécrire le
--    texte d'un brouillon qu'il ne voit pas, ou le faire passer en
--    `ouverte_au_vote` : soumettre au conseil la décision d'un autre, à sa
--    place. L'auteur, lui, peut sortir du brouillon : la ligne NEW n'est alors
--    plus un brouillon, la condition est vraie.
drop policy if exists "decisions_brouillon_update_auteur" on decisions;
-- `with check` OMIS volontairement : pour une policy UPDATE, PostgreSQL réutilise
-- l'expression `using` comme `with check` quand celle-ci est absente. Les deux
-- étaient identiques ici — et l'éditeur SQL de Supabase a refusé la forme longue.
create policy "decisions_brouillon_update_auteur" on decisions
  as restrictive for update to authenticated
  using (phase not in ('brouillon','planifiee') or created_by = current_membre_id());

-- 3. SUPPRESSION — même raison : un DELETE ciblé par id n'a jamais eu besoin du
--    droit de lecture. Fermé pour tout le monde sauf l'auteur.
drop policy if exists "decisions_brouillon_delete_auteur" on decisions;
create policy "decisions_brouillon_delete_auteur" on decisions
  as restrictive for delete to authenticated
  using (
    phase not in ('brouillon','planifiee')
    or created_by = current_membre_id()
  );

-- L'historique SUIT la visibilité de sa décision : sans ça, le texte d'un
-- brouillon privé serait lisible de tous dans `decisions_historique` — c'est
-- exactement ce qu'on vient de cacher. La sous-requête subit la RLS de
-- `decisions` (cf. ci-dessus), donc elle ne renvoie rien pour un brouillon
-- d'autrui, et l'historique disparaît avec lui.
drop policy if exists "historique_suit_la_decision" on decisions_historique;
create policy "historique_suit_la_decision" on decisions_historique
  as restrictive for select to authenticated
  using (exists (select 1 from decisions d where d.id = decision_id));

-- --------------------------------------------------------------------------
-- L'AUTEUR SUPPRIME SON PROPRE BROUILLON (permissive : ouvre le droit)
--
-- Jusqu'ici seul le président supprimait (`write_admin`) : l'auteur d'un
-- brouillon devait soit le lui demander, soit « annuler » — ce qui gare pour
-- toujours au registre une décision annulée, motif obligatoire à l'appui, pour
-- une simple erreur de saisie. Or une décision jamais soumise n'est pas une
-- délibération : rien ne s'est passé juridiquement, rien n'a à rester. Le
-- principe « rien ne disparaît du registre » protège les délibérations, pas les
-- brouillons.
--
-- Bornée à `brouillon` / `planifiee` : dès que le vote est ouvert, l'auteur ne
-- supprime plus (le président le peut encore tant que ce n'est pas enregistré,
-- cf. `decisions_no_delete_enregistree`).
drop policy if exists "decisions_owner_delete" on decisions;
create policy "decisions_owner_delete" on decisions for delete to authenticated
  using (
    created_by = current_membre_id()
    and enregistree = false
    and phase in ('brouillon','planifiee')
  );

-- --------------------------------------------------------------------------
-- Les PIÈCES JOINTES d'un brouillon suivent la même règle.
--
-- `documents_read_auth` (migration 012) laisse tout membre connecté lire
-- n'importe quel objet du bucket. Le devis attaché à un brouillon privé restait
-- donc lisible — pas exploitable en pratique (le chemin se lit sur la ligne,
-- justement cachée), mais une confidentialité qui repose sur « il ne connaît pas
-- l'URL » n'en est pas une.
--
-- On AJOUTE une restrictive à côté plutôt que de réécrire `documents_read_auth` :
-- un échec entre le `drop` et le `create` aurait rendu TOUTES les pièces jointes
-- illisibles en production. Purement additif, donc sans fenêtre de casse.
--
-- La convention de chemin `decisions/<id>/…` (migration 012) porte l'id : la
-- sous-requête subit la RLS de `decisions` et ne renvoie rien pour le brouillon
-- d'autrui. Le premier segment est testé d'abord — un chemin `projets/…`,
-- `resolutions/…` ou hérité ne doit pas être coupé par une règle qui ne le
-- concerne pas (ce qui couvre aussi, au passage, les autres buckets éventuels :
-- une policy restrictive sur storage.objects s'applique à tous).
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

-- On ne vote QUE sur une décision ouverte au vote. Policies RESTRICTIVES
-- (combinées en ET) : `votes_admin` est un `for all using (is_admin())` et les
-- policies permissives se cumulant en OU, une garde permissive de plus laisserait
-- le président voter sur un brouillon. Restrictive = fermé pour tout le monde.
--
-- Portée INSERT + UPDATE seulement : un `for all` aurait aussi filtré le SELECT,
-- donc masqué les votes des décisions enregistrées — c'est-à-dire tout le
-- registre. Le DELETE reste ouvert (retirer un vote = rendre le membre absent) ;
-- il est déjà borné par `votes_self_write` (décision non enregistrée).
drop policy if exists "votes_open_only_insert" on votes;
create policy "votes_open_only_insert" on votes as restrictive for insert to authenticated
  with check (exists (select 1 from decisions d where d.id = decision_id and d.phase = 'ouverte_au_vote'));

drop policy if exists "votes_open_only_update" on votes;
create policy "votes_open_only_update" on votes as restrictive for update to authenticated
  using (exists (select 1 from decisions d where d.id = decision_id and d.phase = 'ouverte_au_vote'));

-- =============================================================================
-- Planificateur pg_cron
--
-- Cadence HORAIRE, et non « quotidienne à 07:00 » comme le propose la spec §5 :
-- `date_soumission_prevue` porte une HEURE, donc un passage quotidien ouvrirait
-- une décision prévue à 14:00 le lendemain matin seulement. L'horaire évite en
-- prime le décalage heure d'été / heure d'hiver d'un cron réglé en UTC.
--
-- ⚠ Deux instructions NUES, pas un bloc `do` : l'éditeur SQL de Supabase ne
-- digère pas un `$job$` imbriqué dans un `$pgcron$` (incident 2026-08-25). Si
-- `create extension` est refusé faute de droits, activer pg_cron par le
-- Dashboard (Database > Extensions) puis rejouer le `cron.schedule` seul —
-- sans lui, l'ouverture automatique ne repose que sur le filet applicatif.
-- Vérification : select * from cron.job where jobname = 'ouvrir-decisions-planifiees';
-- =============================================================================
create extension if not exists pg_cron;

select cron.schedule(
  'ouvrir-decisions-planifiees',
  '0 * * * *',
  $job$select public.ouvrir_decisions_planifiees('cron')$job$
);
