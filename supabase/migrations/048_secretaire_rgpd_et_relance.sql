-- =============================================================================
-- Migration 048 — DEUX ÉCRITURES QUE LE SECRÉTAIRE NE POUVAIT PAS FAIRE
--
-- Trouvées le 2026-09-04 par Pascal en recette sur le staging, connecté EN
-- SECRÉTAIRE — c'est-à-dire dans les seules conditions où elles pouvaient
-- apparaître. Ni le compte président (qui passe partout par `write_admin`) ni le
-- mode démo (qui n'a pas de RLS) ne pouvaient les révéler.
--
-- LES DEUX ONT LA MÊME FORME, et c'est la leçon à retenir : une écriture rejetée
-- par la RLS ne lève AUCUNE erreur. PostgREST renvoie `data: []`, `error: null`.
-- `must()` ne voit rien à signaler, l'écran croit avoir réussi. Le symptôme
-- n'apparaît qu'au rechargement suivant, très loin de la cause. Même famille que
-- l'incident de casse d'e-mail du 2026-07-19 (migration 018).
--
-- --------------------------------------------------------------------------
-- 1. ACCEPTATION RGPD — jamais enregistrée pour le secrétaire
-- --------------------------------------------------------------------------
-- Symptôme : « il me redemande à chaque action de valider le RGPD dans le
-- registre des propriétaires, on dirait qu'il ne l'enregistre pas. » Exactement
-- cela : `membres_cs` ne porte que `read_auth` (select) et `write_admin`
-- (`is_admin()`). Le secrétaire n'est pas président — son UPDATE touchait ZÉRO
-- ligne. `RgpdGate` masquait l'échec dans la session courante par son état local
-- `accepteLocal`, d'où un écran qui revient dès qu'on le remonte.
--
-- ⚠ LA CORRECTION N'EST PAS D'OUVRIR `membres_cs` EN ÉCRITURE À CHACUN SUR SA
-- PROPRE LIGNE. Une policy `using (id = current_membre_id())` laisserait un
-- membre changer son `role`, son `email` ou son `actif` — donc se faire
-- président. La RLS ne sait pas restreindre les COLONNES ; on passe donc par une
-- fonction `security definer` à portée étroite, qui n'écrit que cette colonne.
--
-- L'identité vient de `current_membre_id()`, JAMAIS d'un argument : on ne laisse
-- pas le client désigner pour qui il accepte une mention légale.
-- `coalesce(..., now())` garde la PREMIÈRE acceptation — réaccepter ne réécrit
-- pas la date, et le trigger d'audit `trg_membres_audit_rgpd` ne se déclenche
-- donc pas une seconde fois.
-- --------------------------------------------------------------------------

create or replace function accepter_rgpd_registre()
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_membre uuid;
  v_date   timestamptz;
begin
  v_membre := current_membre_id();
  if v_membre is null then
    raise exception 'Aucune fiche de membre ne correspond a ce compte : acceptation impossible.';
  end if;

  update membres_cs
     set registre_rgpd_accepte_le = coalesce(registre_rgpd_accepte_le, now())
   where id = v_membre
  returning registre_rgpd_accepte_le into v_date;

  return v_date;
end $$;

revoke all on function accepter_rgpd_registre() from public;
grant execute on function accepter_rgpd_registre() to authenticated;

-- --------------------------------------------------------------------------
-- 2. RELANCE DU VOTE — réservée à l'auteur et au président
-- --------------------------------------------------------------------------
-- Symptôme : « je ne peux pas relancer le vote sur une décision qui n'est pas la
-- mienne alors que c'est un rôle du secrétaire. » Arbitrage Pascal du
-- 2026-09-04 : convoquer et relancer le conseil EST la fonction du secrétaire.
--
-- Le bouton était gardé par `(isOwner || isAdmin)` côté écran, et l'écriture de
-- `date_notification` par `decisions_owner_update` / `write_admin` côté base.
-- Ouvrir le bouton seul n'aurait rien donné : l'update serait reparti à zéro
-- ligne, en silence, exactement comme le RGPD.
--
-- ⚠ ON N'ÉLARGIT PAS `decisions` EN ÉCRITURE AU SECRÉTAIRE. Le registre est
-- légal : lui donner un UPDATE sur la table lui donnerait le montant, le
-- rattachement, la visibilité — et, si une policy dérivait un jour, l'acte
-- lui-même. Une fonction étroite n'écrit QUE l'horodatage du partage.
--
-- Elle ne change rien pour l'auteur ni le président : ils passaient déjà. On les
-- fait passer par le MÊME chemin plutôt que d'en maintenir deux — c'est la
-- divergence entre deux chemins qui a laissé vivre les défauts de cette journée.
--
-- Périmètre : une décision non encore SOUMISE n'a rien à annoncer (le brouillon
-- d'un autre n'est d'ailleurs même pas lisible). Une décision ANNULÉE reste
-- notifiable : annoncer un retrait est justement ce qu'on veut pouvoir faire.
-- Une décision ENREGISTRÉE aussi : on annonce le résultat.
-- --------------------------------------------------------------------------

create or replace function marquer_decision_notifiee(p_decision_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_membre uuid;
  v_auteur uuid;
  v_phase  text;
  v_date   timestamptz;
begin
  v_membre := current_membre_id();
  if v_membre is null then
    raise exception 'Aucune fiche de membre ne correspond a ce compte.';
  end if;

  select d.created_by, d.phase into v_auteur, v_phase
    from decisions d where d.id = p_decision_id;

  if v_phase is null then
    raise exception 'Decision introuvable.';
  end if;

  if v_phase in ('brouillon','planifiee') then
    raise exception 'Rien a annoncer : la decision n a pas encore ete soumise au vote.';
  end if;

  -- Auteur, président ou secrétaire. `is_admin()` et `is_secretaire()` lisent le
  -- rôle en base, jamais un drapeau venu du client.
  if not (v_auteur = v_membre or is_admin() or is_secretaire()) then
    raise exception 'Seuls l auteur, le president et le secretaire annoncent une decision au conseil.';
  end if;

  update decisions
     set date_notification = now()
   where id = p_decision_id
  returning date_notification into v_date;

  return v_date;
end $$;

revoke all on function marquer_decision_notifiee(uuid) from public;
grant execute on function marquer_decision_notifiee(uuid) to authenticated;
