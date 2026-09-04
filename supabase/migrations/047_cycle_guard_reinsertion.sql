-- =============================================================================
-- Migration 047 — RÉINSÉRER N'EST PAS SOUMETTRE
--
-- Défaut trouvé le 2026-09-04 en restaurant réellement une sauvegarde sur un
-- projet vierge — la première fois que l'opération était faite en vrai.
--
-- `decisions_cycle_guard` s'applique `before insert or update`. Ses étapes 1 à 4
-- se gardent toutes par `v_maj` (donc UPDATE seul), mais l'étape 5 — gel du
-- texte, empreinte SHA-256, `soumise_le`, recalage des dates, NUMÉRO — ne se
-- gardait pas. Elle s'est donc déclenchée sur la RÉINSERTION d'une ligne qui
-- existait déjà au registre, avec deux conséquences que le registre ne peut pas
-- porter :
--
--   1. `soumise_le` a pris la date de la RESTAURATION. Une délibération soumise
--      en juillet ressortait soumise le jour où l'on a rejoué la sauvegarde.
--      C'est un fait faux dans un registre légal, et rien ne le signalait.
--   2. La décision 2026-003, ANTÉRIEURE à la migration 026, s'est retrouvée
--      GELÉE. L'étape 3 dit pourtant explicitement le contraire : la garde
--      porte sur `contenu_gele is not null` et non sur la phase, « pour ne pas
--      geler rétroactivement les décisions antérieures à 026 ». La restauration
--      changeait le régime juridique de la délibération.
--
-- Autrement dit : une sauvegarde restaurée ne reproduisait pas le registre.
--
-- ⚠ LA CORRECTION N'EST PAS DE RETIRER `insert` DU TRIGGER. L'application crée
-- bel et bien une décision directement `ouverte_au_vote` en UNE écriture — c'est
-- le bouton « Enregistrer et soumettre » d'une décision neuve (`DecisionForm`,
-- `payload.phase = phaseVisee` à la création). Priver l'insertion de l'étape 5
-- produirait une délibération ouverte au vote sans numéro, sans empreinte et
-- sans texte gelé : bien pire que le défaut corrigé ici.
--
-- On distingue donc les deux insertions par ce que la ligne PORTE DÉJÀ. Une
-- soumission neuve arrive nue : ni numéro (attribué ici même depuis la 034), ni
-- date de soumission. Une ligne qui porte l'un ou l'autre a déjà été soumise un
-- jour — elle est réinsérée, pas soumise. Elle passe alors intacte.
--
-- Le cas `contenu_gele is not null` était déjà couvert par hasard : la condition
-- de l'étape 5 l'exclut. C'est pourquoi une seule décision sur huit a été
-- abîmée, celle d'avant le gel — le défaut se cachait derrière son propre
-- garde-fou partiel.
--
-- Effet en exploitation normale : AUCUN. La production n'insère jamais une
-- décision qui porte déjà un numéro. Ce correctif ne sert qu'aux réinsertions —
-- restauration, reprise de données, migration de projet — c'est-à-dire au jour
-- où tout le reste aura échoué.
-- =============================================================================

create or replace function decisions_cycle_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_maj     boolean;
  v_change  boolean := false;
  v_reprise boolean;
  v_texte   text;
  v_annee   integer;
  v_seq     integer;
begin
  -- ⚠ FORME CONTRAINTE PAR L'ÉDITEUR SQL DE SUPABASE, pas par le goût.
  -- Interdits, sous peine de rejet AVANT Postgres : toute chaine vide, toute
  -- apostrophe échappée, tout argument de formatage de `raise`. Messages NUS.
  v_maj := tg_op = 'UPDATE';

  -- REPRISE : une insertion dont la ligne porte déjà un numéro ou une date de
  -- soumission n'est pas une soumission, c'est une délibération qui existait
  -- déjà et qu'on réinsère. Elle garde ses dates, son empreinte et son régime.
  v_reprise := tg_op = 'INSERT' and (new.numero is not null or new.soumise_le is not null);

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
  --    `not v_reprise` (migration 047) : on ne soumet pas une seconde fois une
  --    délibération qui a déjà été soumise, on la réinsère telle quelle.
  if new.phase = 'ouverte_au_vote' and new.contenu_gele is null and not v_reprise then
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
