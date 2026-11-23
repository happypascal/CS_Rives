-- =====================================================================
-- Migration 073 — RETIRER UNE DELIBERATION DEJA VOTEE
--
-- Pascal, 23 novembre 2026 : comment retirer une decision qui a deja
-- recu des votes, qui n est pas encore enregistree, mais qui n a plus
-- de raison d etre, en disant pourquoi.
--
-- =====================================================================
-- 1. LE TROU QUE CETTE MIGRATION COMBLE
-- =====================================================================
-- Avant elle, cette decision n avait AUCUNE SORTIE :
--   - annuler etait refuse par le garde de cycle, dont la table des
--     transitions laisse `ouverte_au_vote` sans successeur, et le
--     bouton n etait meme pas rendu par l ecran ;
--   - supprimer etait ferme des le DEUXIEME vote (garde de saisie,
--     arbitrage du 16 juillet 2026) ;
--   - restait a l enregistrer, c est-a-dire a inscrire au registre
--     legal une deliberation dont le conseil ne veut plus.
--
-- ⚠ ET LE MANUEL PROMETTAIT L INVERSE. Le parcours « Retirer une
-- decision » dit « Soumise et deja votee : annulez » — un geste
-- que ni l ecran ni le trigger ne permettent. Corrige dans le meme
-- lot : un manuel qui promet un bouton inexistant est pire que pas de
-- manuel.
--
-- =====================================================================
-- 2. POURQUOI UNE PHASE NEUVE, ET NON UN `annulee` DE PLUS
-- =====================================================================
-- Trois raisons, et chacune suffirait.
--
-- ⚠ `annulee` VEUT DIRE « AVANT OUVERTURE DU VOTE », partout. Le
-- PDF de la decision imprime litteralement « Annulee avant soumission
-- au conseil », et le commentaire du predicat de budget dit « retiree
-- avant meme d etre soumise ». Reutiliser cette valeur ferait mentir
-- un document destine a etre signe.
--
-- ⚠ UNE DECISION `annulee` N AFFICHE PAS SES VOTES. L ecran masque la
-- carte des votes des que la phase vaut `annulee` — ce qui est juste,
-- puisque personne n a pu voter. Appliquee ici, cette regle ferait
-- DISPARAITRE les votes deja exprimes. Un registre legal ne cache pas
-- que des membres se sont prononces.
--
-- ⚠ CE N EST PAS LE MEME ACTEUR. Annuler un brouillon appartient a
-- son AUTEUR : rien ne s est passe juridiquement. Retirer une
-- deliberation dont le conseil est saisi et sur laquelle des membres
-- ont vote est un acte du PRESIDENT, comme l enregistrement. Voir la
-- policy au paragraphe 5.
--
-- =====================================================================
-- 3. POURQUOI LE MOTIF REUTILISE `motif_annulation`
-- =====================================================================
-- Une seconde colonne de motif serait un doublon : les deux expriment
-- la meme chose — pourquoi la decision a ete retiree — et seul le
-- MOMENT du retrait differe, ce que la phase porte deja. C est
-- exactement le raisonnement tenu en 072 pour `acte_declare_le`, qui
-- sert deux statuts et dont seul le LIBELLE change a l ecran.
--
-- ⚠ Le nom de la colonne dit « annulation » et couvre desormais les
-- deux retraits. Assume : la renommer toucherait le PDF, les deux
-- backends et la liste de colonnes du select, sur un registre legal,
-- pour un gain de vocabulaire. L ecran dit « Motif du retrait ».
--
-- =====================================================================
-- 4. CE QUI EST ACQUIS SANS RIEN ECRIRE — verifie, pas suppose
-- =====================================================================
-- ⚠ LE VOTE SE FERME TOUT SEUL. Les deux policies restrictives
-- `votes_open_only_insert` et `votes_open_only_update` exigent
-- la phase ouverte au vote : une decision retiree n accepte plus ni
-- vote ni modification de vote. Le DELETE reste ouvert, comme avant.
--
-- ⚠ L ENREGISTREMENT SE FERME TOUT SEUL. La contrainte
-- `decisions_enregistree_phase_check` impose
-- que la phase vaille ouverte au vote des que enregistree est vrai :
-- une decision retiree ne peut donc pas etre enregistree. Le verrou
-- de l article 15 joue dans les deux sens.
--
-- ⚠ LE NUMERO EST CONSERVE. Attribue a la soumission (034), rien ne
-- le reprend : la decision a bien ete portee au conseil. Un
-- numero efface ferait un trou dans le registre, ce qui se lit comme
-- une deliberation dissimulee.
--
-- ⚠ CE QUI N EST PAS ACQUIS, ET QUE LE SQL NE PEUT PAS FAIRE : les
-- budgets sont calcules en JavaScript (`peseSurLeBudget`), qui exclut
-- `annulee` et doit desormais exclure `retiree` — sinon le montant
-- d une decision retiree resterait affiche en « engage en cours » et
-- ferait croire l argent reserve pour toujours. Fait dans le meme lot.
--
-- =====================================================================
-- 5. FORME
-- =====================================================================
-- ⚠ RAPPEL (editeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbrique,
-- aucune apostrophe dans un commentaire, aucune ligne de plus de 72
-- colonnes. La 071 a echoue sur une contrainte posee avant sa reprise,
-- et des collages anterieurs ont ete corrompus sur ces points.
--
-- ⚠ LE CORPS DU TRIGGER EST REPRODUIT EN ENTIER, Postgres ne sachant
-- pas remplacer un seul bloc. Seules DEUX lignes changent par rapport
-- a la 049 : la table des transitions et la garde de motif. Les
-- commentaires internes sont ici abreges et sans apostrophe pour la
-- raison ci-dessus ; leur version longue reste dans schema.sql et
-- dans les migrations 026, 047 et 049.
-- =====================================================================

-- ------------------------------------------------- valeurs de la phase
alter table decisions drop constraint if exists decisions_phase_check;
alter table decisions add constraint decisions_phase_check
  check (phase in ('brouillon', 'planifiee', 'ouverte_au_vote',
                   'annulee', 'retiree'));

comment on column decisions.phase is
  'Ou en est la decision dans son cycle, axe DISTINCT de statut. brouillon et planifiee : le conseil n est pas saisi, seul l auteur voit. ouverte_au_vote : la deliberation est en cours. annulee : retiree AVANT ouverture du vote, par son auteur, motif obligatoire, aucun vote na pu etre exprime. retiree : retiree APRES ouverture du vote et sans avoir ete enregistree, par le president, motif obligatoire, et LES VOTES DEJA EXPRIMES RESTENT VISIBLES. Les deux derniers sont terminaux.';

comment on column decisions.motif_annulation is
  'Pourquoi la deliberation a ete retiree. Sert aux DEUX retraits, annulee et retiree, le moment du retrait etant porte par la phase. Obligatoire des que la phase vaut annulee ou retiree, garde posee par le trigger decisions_cycle_guard.';

-- ------------------------------------------------------ garde de cycle
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
  -- Forme contrainte par l editeur SQL de Supabase. Messages NUS.
  v_maj := tg_op = 'UPDATE';

  -- REPRISE (047) : une insertion portant deja un numero ou une date
  -- de soumission est une reinsertion, pas une soumission.
  v_reprise := tg_op = 'INSERT' and (new.numero is not null or new.soumise_le is not null);

  -- OUVERTURE (049) : le moment, unique, ou le vote s ouvre.
  v_ouverture := (tg_op = 'INSERT' and not v_reprise)
              or (v_maj and new.phase is distinct from old.phase and new.phase = 'ouverte_au_vote');

  if v_maj then
    v_change := new.titre is distinct from old.titre or new.description is distinct from old.description;
  end if;

  -- 1. Transitions autorisees. Une deliberation soumise ne se
  --    de-soumet pas, et un retrait est TERMINAL.
  --    ⚠ LIGNE NOUVELLE EN 073 : ouverte_au_vote vers retiree, la
  --    seule sortie d une deliberation votee que le conseil abandonne.
  if v_maj and new.phase is distinct from old.phase then
    if not (
      (old.phase = 'brouillon' and new.phase in ('planifiee','ouverte_au_vote','annulee'))
      or (old.phase = 'planifiee' and new.phase in ('brouillon','ouverte_au_vote','annulee'))
      or (old.phase = 'ouverte_au_vote' and new.phase = 'retiree')
    ) then
      raise exception 'Transition de phase interdite : une deliberation enregistree ou deja retiree ne revient pas en arriere, et une deliberation soumise ne se de-soumet pas.';
    end if;
  end if;

  -- 2. Retrait : motif OBLIGATOIRE, pour les DEUX phases de retrait.
  if new.phase in ('annulee', 'retiree')
     and coalesce(length(btrim(new.motif_annulation)), 0) = 0 then
    raise exception 'Retrait impossible sans motif : le registre doit dire pourquoi la deliberation a ete retiree.';
  end if;

  -- 3. GEL DU TEXTE. La garde porte sur contenu_gele, non sur la
  --    phase, pour ne pas geler les decisions anterieures a la 026.
  if v_maj and v_change and old.contenu_gele is not null then
    raise exception 'Texte gele : la deliberation soumise au vote ne peut plus etre modifiee.';
  end if;

  -- 4. Historique + version, tant que la decision est un brouillon.
  if v_maj and v_change and old.phase in ('brouillon','planifiee') then
    new.version := old.version + 1;
    insert into decisions_historique (decision_id, version, titre, contenu, modifie_par)
      values (new.id, new.version, new.titre, concat(new.description), current_membre_id());
  end if;

  -- 5. OUVERTURE DU VOTE : gel, empreinte, dates, NUMERO (034).
  if new.phase = 'ouverte_au_vote' and new.contenu_gele is null and v_ouverture then
    new.soumise_le := coalesce(new.soumise_le, now());
    v_texte := concat(new.titre, chr(10), chr(10), new.description);
    new.contenu_gele := v_texte;
    new.hash_contenu := encode(sha256(convert_to(v_texte, 'UTF8')), 'hex');
    if v_maj and old.phase in ('brouillon','planifiee') then
      new.date_publication := (new.soumise_le at time zone 'Europe/Paris')::date;
      new.date_limite_reponse := jours_ouvres_apres(new.date_publication, new.delai_vote_jours);
    end if;

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

-- ------------------------------------------------ le retrait au bureau
-- ⚠ POLICY RESTRICTIVE, et il en faut une : `write_admin` reserve deja
-- tout au president, mais `decisions_owner_update` est PERMISSIVE et
-- les permissives se cumulent en OU — l auteur pourrait donc retirer
-- lui-meme une deliberation dont le conseil est saisi. Meme patron que
-- la clause porteuse `with check (enregistree = false)` de cette meme
-- policy, qui reserve l acte d enregistrement au president.
--
-- ⚠ EFFET DE BORD ASSUME : une deliberation DEJA retiree devient
-- intouchable aux non-presidents, la clause ne voyant que la ligne
-- nouvelle. C est voulu — son texte est gele et son vote est clos. La
-- notification continue de passer : `marquer_decision_notifiee` (048)
-- est `security definer` et echappe donc a la RLS.
drop policy if exists "decisions_retrait_president" on decisions;
create policy "decisions_retrait_president" on decisions
  as restrictive for update to authenticated
  using (true)
  with check (phase <> 'retiree' or is_admin());

-- ------------------------------------------------------ verification
select
  phase,
  count(*)                                         as decisions,
  count(motif_annulation)                          as avec_motif,
  count(*) filter (where enregistree)              as enregistrees
  from decisions
 group by phase
 order by phase;
