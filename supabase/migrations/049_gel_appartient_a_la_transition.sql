-- =============================================================================
-- Migration 049 — LE GEL APPARTIENT À L'OUVERTURE, PAS À TOUTE MISE À JOUR
--
-- Suite directe de la 047, trouvée en préparant la relance du secrétaire (048).
-- La 047 a réglé l'INSERTION ; il restait le même défaut du côté de l'UPDATE.
--
-- L'étape 5 du garde de cycle se déclenche dès que `phase = 'ouverte_au_vote'`
-- et `contenu_gele is null` — sans vérifier qu'on est en train d'OUVRIR le vote.
-- Sur une décision antérieure à la migration 026 (ouverte, jamais gelée, il y en
-- a dans le registre : la 2026-003), n'importe quelle mise à jour la gelait et
-- reposait `soumise_le` au jour du clic. N'importe laquelle : changer la
-- visibilité, horodater un partage au CS, rattacher un projet.
--
-- Deux raisons d'y toucher maintenant :
--   1. C'est exactement ce que l'étape 3 dit vouloir éviter — sa garde porte sur
--      `contenu_gele is not null` et non sur la phase, « pour ne pas geler
--      rétroactivement les décisions antérieures à 026 ». La promesse tenait
--      jusqu'au premier UPDATE, et pas au-delà.
--   2. La migration 048 donne au secrétaire le droit de relancer le vote. Sans
--      ce correctif, la première relance sur la 2026-003 daterait la
--      délibération du jour de la relance.
--
-- La règle devient celle que le titre de l'étape annonce depuis toujours :
-- « OUVERTURE DU VOTE ». On gèle quand on OUVRE — insertion d'une décision
-- soumise d'emblée, ou passage de brouillon/planifiée à ouverte — et jamais sur
-- une décision déjà ouverte, qui a déjà eu son moment d'ouverture.
--
-- ⚠ Aucun gel rétroactif n'est défait ici : ce qui a déjà été gelé le reste. Une
-- délibération ne se dé-gèle pas parce qu'on a corrigé le code qui l'a gelée.
-- =============================================================================

create or replace function decisions_cycle_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_maj       boolean;
  v_change    boolean := false;
  v_reprise   boolean;
  v_ouverture boolean;
  v_texte     text;
  v_annee     integer;
  v_seq       integer;
begin
  -- ⚠ FORME CONTRAINTE PAR L'ÉDITEUR SQL DE SUPABASE, pas par le goût.
  -- Interdits, sous peine de rejet AVANT Postgres : toute chaine vide, toute
  -- apostrophe échappée, tout argument de formatage de `raise`. Messages NUS.
  v_maj := tg_op = 'UPDATE';

  -- REPRISE (047) : une insertion qui porte déjà un numéro ou une date de
  -- soumission n'est pas une soumission, c'est une réinsertion (restauration,
  -- reprise de données). Elle garde ses dates, son empreinte et son régime.
  v_reprise := tg_op = 'INSERT' and (new.numero is not null or new.soumise_le is not null);

  -- OUVERTURE (049) : le moment, unique, où le vote s'ouvre. Soit l'insertion
  -- d'une décision soumise d'emblée, soit le PASSAGE à `ouverte_au_vote`. Une
  -- décision déjà ouverte n'est jamais ouverte une seconde fois.
  v_ouverture := (tg_op = 'INSERT' and not v_reprise)
              or (v_maj and new.phase is distinct from old.phase and new.phase = 'ouverte_au_vote');

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
  --    `v_ouverture` (049) : on gèle au moment où le vote s'ouvre, jamais à
  --    chaque mise à jour d'une décision déjà ouverte.
  if new.phase = 'ouverte_au_vote' and new.contenu_gele is null and v_ouverture then
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
