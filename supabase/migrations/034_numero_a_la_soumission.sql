-- =============================================================================
-- Migration 034 — le NUMÉRO est attribué À LA SOUMISSION, plus à la création
--
-- Problème signalé par Pascal (2026-08-26) : « la numérotation des décisions est
-- automatique. Du coup quand on crée un brouillon, ça prend déjà le numéro
-- subséquent. Et si on crée une autre décision, il y a un saut dans les
-- numéros. »
--
-- C'est un défaut réel, et il touche la valeur du registre : un brouillon
-- abandonné laissait un TROU DÉFINITIF dans la numérotation. Devant un registre
-- légal, un numéro manquant se lit comme une délibération retirée — exactement
-- ce qu'on ne veut pas laisser croire. Et deux membres rédigeant en parallèle
-- réservaient deux numéros dont l'un ne serait jamais utilisé.
--
-- Nouveau principe : **un brouillon n'a pas de numéro.** Il en reçoit un au
-- moment où il est SOUMIS AU VOTE, c'est-à-dire au moment où il entre au
-- registre. La numérotation suit donc l'ordre réel des soumissions, sans trou,
-- et l'année est celle de l'ouverture (la date de publication étant elle-même
-- recalée à ce moment-là, cf. migration 026).
--
-- -----------------------------------------------------------------------------
-- ⚠ CONCURRENCE — le point non évident
--
-- Le numéro se calcule en « max + 1 de l'année ». Si DEUX décisions planifiées
-- s'ouvrent dans le même ordre SQL (le cron en traite plusieurs d'un coup), le
-- trigger s'exécute une fois par ligne mais toutes voient le même instantané :
-- elles calculeraient le MÊME numéro, et l'unicité ferait échouer tout le cron.
-- D'où la réécriture de `ouvrir_decisions_planifiees` en BOUCLE : un `update`
-- par décision, donc un instantané neuf à chaque fois. Ne pas « optimiser » en
-- revenant à un update de masse.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase, incidents du 2026-08-25) : aucune
-- chaine vide, aucun argument de formatage de `raise`, aucun guillemet dollar
-- imbriqué, aucun deux-points dans une chaine.
-- =============================================================================

-- 1. Un brouillon n'a pas de numéro. L'unicité est conservée : PostgreSQL
--    autorise plusieurs NULL dans un index unique, donc autant de brouillons
--    qu'on veut, et toujours un seul 2026-007.
alter table decisions alter column numero drop not null;

-- 2. La fonction qui servait à proposer un numéro à la CRÉATION n'a plus d'objet.
--    Le formulaire ne l'appelle plus ; la laisser serait du code mort exposé en
--    `security definer`.
drop function if exists prochain_numero_decision(integer);

-- 3. Le trigger de cycle attribue désormais le numéro à l'ouverture du vote.
create or replace function decisions_cycle_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_maj    boolean;
  v_change boolean := false;
  v_texte  text;
  v_annee  integer;
  v_seq    integer;
begin
  -- ⚠ FORME CONTRAINTE PAR L'ÉDITEUR SQL DE SUPABASE, pas par le goût.
  -- Interdits, sous peine de rejet AVANT Postgres : toute chaine vide, toute
  -- apostrophe échappée, tout argument de formatage de `raise`. Messages NUS.
  v_maj := tg_op = 'UPDATE';

  if v_maj then
    v_change := new.titre is distinct from old.titre or new.description is distinct from old.description;
  end if;

  -- 1. Transitions autorisées : une délibération soumise ne se dé-soumet pas.
  if v_maj and new.phase is distinct from old.phase then
    if not (
      (old.phase = 'brouillon' and new.phase in ('planifiee','ouverte_au_vote','annulee'))
      or (old.phase = 'planifiee' and new.phase in ('brouillon','ouverte_au_vote','annulee'))
    ) then
      raise exception 'Transition de phase interdite : une délibération déjà soumise au vote, ou annulée, ne revient pas en arrière.';
    end if;
  end if;

  -- 2. Annulation : motif OBLIGATOIRE.
  if new.phase = 'annulee' and coalesce(length(btrim(new.motif_annulation)), 0) = 0 then
    raise exception 'Annulation impossible sans motif : le registre doit dire pourquoi la décision a été retirée.';
  end if;

  -- 3. GEL DU TEXTE. La garde porte sur `contenu_gele is not null` et NON sur la
  --    phase, pour ne pas geler rétroactivement les décisions antérieures à 026.
  if v_maj and v_change and old.contenu_gele is not null then
    raise exception 'Texte gelé : la délibération soumise au vote ne peut plus être modifiée.';
  end if;

  -- 4. Historique + version, tant que la décision est un brouillon.
  if v_maj and v_change and old.phase in ('brouillon','planifiee') then
    new.version := old.version + 1;
    insert into decisions_historique (decision_id, version, titre, contenu, modifie_par)
      values (new.id, new.version, new.titre, concat(new.description), current_membre_id());
  end if;

  -- 5. OUVERTURE DU VOTE : gel, empreinte, recalage des dates, NUMÉRO.
  if new.phase = 'ouverte_au_vote' and new.contenu_gele is null then
    new.soumise_le := coalesce(new.soumise_le, now());
    v_texte := concat(new.titre, chr(10), chr(10), new.description);
    new.contenu_gele := v_texte;
    new.hash_contenu := encode(sha256(convert_to(v_texte, 'UTF8')), 'hex');
    if v_maj and old.phase in ('brouillon','planifiee') then
      new.date_publication := (new.soumise_le at time zone 'Europe/Paris')::date;
      new.date_limite_reponse := jours_ouvres_apres(new.date_publication, new.delai_vote_jours);
    end if;

    -- NUMÉRO attribué ICI et nulle part ailleurs (migration 034). Un brouillon
    -- n'en a pas : abandonné, il ne laisse aucun trou dans le registre. La
    -- numérotation suit donc l'ordre réel des soumissions, et l'année est celle
    -- de l'ouverture — la date de publication venant d'être recalée.
    if new.numero is null then
      v_annee := extract(year from new.date_publication)::integer;
      select coalesce(max(seq), 0) + 1 into v_seq
        from (
          select case when substring(d.numero from 6) ~ '^[0-9][0-9][0-9]'
                      then substring(d.numero from 6 for 3)::integer end as seq
            from decisions d
           where left(d.numero, 5) = concat(v_annee, '-')
        ) t;
      new.numero := concat(v_annee, '-', lpad(v_seq::text, 3, '0'));
    end if;
  end if;

  return new;
end $$;

-- 4. L'ouverture automatique passe en boucle (cf. l'avertissement en tête).
create or replace function ouvrir_decisions_planifiees(p_source text default 'app')
returns integer language plpgsql security definer set search_path = public as $$
declare
  r         record;
  v_numeros text[];
  v_n       integer := 0;
begin
  -- ⚠ BOUCLE, et non un update de masse (migration 034). Le numéro se calcule en
  -- « max + 1 » : deux lignes traitées par la MÊME commande verraient le même
  -- instantané et tireraient le même numéro, faisant échouer tout le cron sur
  -- l'unicité. Un update par décision = un instantané neuf à chaque tour.
  -- Ne pas « optimiser » en revenant à un update unique.
  for r in
    select id from decisions
     where phase = 'planifiee'
       and date_soumission_prevue is not null
       and date_soumission_prevue <= now()
     order by date_soumission_prevue, created_at
  loop
    update decisions set phase = 'ouverte_au_vote' where id = r.id;
    v_n := v_n + 1;
    v_numeros := array_append(v_numeros, (select numero from decisions where id = r.id));
  end loop;

  if v_n > 0 then
    insert into cron_runs (tache, source, traitees, detail)
      values ('ouvrir_decisions_planifiees', p_source, v_n, array_to_string(v_numeros, ', '));
  end if;
  return v_n;
end $$;
