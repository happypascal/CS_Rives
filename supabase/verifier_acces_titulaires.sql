-- =====================================================================
-- VERIFIER QUI VOIT QUOI — table `titulaires` et prefixe de Storage
-- (migration 068)
--
-- Pascal, 22 octobre 2026 : « je suis president donc pas le mieux pour
-- tester ». Juste : `is_admin()` est vrai pour lui, donc il franchit
-- toutes les gardes et son essai ne prouverait que la non-regression,
-- jamais que la garde FERME.
--
-- Ce test usurpe l identite des trois roles. C est le seul endroit ou
-- l on peut etre quelqu un d autre sans son mot de passe, et aussi la
-- seule facon de voir ce que voit le role `authenticated` : tous les
-- scripts du projet emploient la cle `service_role`, qui contourne a
-- la fois les droits et la RLS — donc qui ne prouve rien sur les
-- acces. Et la cle qui permettrait de forger un jeton (le secret JWT)
-- n est pas dans `.env.export` : le test ne peut pas se faire depuis
-- un script, il doit se faire ici.
--
-- =====================================================================
-- ⚠ POURQUOI UNE FONCTION, ET PAS UN SIMPLE BLOC
-- =====================================================================
-- Premiere version, le 22 octobre : un `begin`, une table temporaire,
-- trois `set local role`, un `rollback`. Elle a echoue sur
-- ERROR 42P01, relation verif does not exist.
--
-- ⚠ L EDITEUR SQL NE GARANTIT PAS UNE SESSION CONTINUE entre les
-- instructions : la connexion est mutualisee, et une instruction peut
-- atterrir sur un autre backend que la precedente. TOUT ce qui est
-- porte par la session ou la transaction est donc perdu en route —
-- table temporaire, `set local role`, claims poses par `set_config`.
-- C est la meme famille de piege que le repli a 80 colonnes : ce qui
-- marche dans un terminal psql ne marche pas forcement ici.
--
-- D ou UNE SEULE INSTRUCTION : une fonction, qui fait tenir le
-- changement de role ET la lecture dans le meme appel.
--
-- ⚠ ET ELLE TESTE LA VRAIE RLS, pas une copie du predicat. Compter les
-- lignes reellement visibles apres `set local role authenticated` est
-- autre chose que reevaluer `is_admin()` a la main : la seconde forme
-- verifie ma comprehension de la policy, la premiere verifie la
-- policy.
--
-- ⚠ Chaque lecture est dans son propre `begin ... exception` : un
-- refus de droits sur une colonne ne doit pas emporter tout le
-- resultat. Un refus s affiche en clair dans la case.
--
-- =====================================================================
-- MODE OPERATOIRE — DEUX COLLAGES
-- =====================================================================
-- 1. Coller tout ce fichier et lancer. La derniere instruction est le
--    `select`, donc c est son tableau qui s affiche.
-- 2. Puis lancer la ligne de nettoyage, donnee a la fin en commentaire
--    (elle est commentee pour que le `select` reste le dernier
--    resultat visible).
--
-- CE QUE LE TABLEAU DOIT DIRE
--   president   102 · pj_proprietaires = true
--   secretaire  102 · pj_proprietaires = true
--   tresorier     0 · pj_proprietaires = false
--
-- Et `pj_decisions` doit etre IDENTIQUE sur les trois lignes, et non
-- nul : c est la non-regression. Les deux policies restrictives de la
-- 068 portent sur tout le bucket, elles ne doivent fermer que le
-- prefixe proprietaires.
--
-- ⚠ Un « refus permission denied for table titulaires » ne serait pas
-- la RLS mais un GRANT manquant pour le role `authenticated` — et
-- l application ne pourrait alors pas lire la table du tout, pas meme
-- pour le president. Le correctif tiendrait en une ligne.
--
-- ⚠ Pas de deux-points ni de barre oblique dans une chaine (rappel de
-- forme) : les claims sont fabriques par `jsonb_build_object`, et le
-- chemin d essai assemble avec chr(47). Effet utile, cela eprouve au
-- passage `storage.foldername`, le seul morceau de la policy que je
-- n avais verifie que par raisonnement.
-- =====================================================================

create or replace function public.verifier_acces_068()
returns table (
  qui              text,
  titulaires_vus   text,
  pj_proprietaires text,
  pj_decisions     text
)
language plpgsql
security invoker
as $verif_068$
declare
  r record;
  chemin text := 'proprietaires' || chr(47) || 'essai'
                 || chr(47) || 'piece.pdf';
begin
  for r in
    select * from (values
      ('president',  'pfavre25@gmail.com'),
      ('secretaire', 'phbermejo@gmail.com'),
      ('tresorier',  'nicolas@maunoir.ch')
    ) as v(role_qui, role_email)
  loop
    qui := r.role_qui;
    perform set_config('request.jwt.claims',
      jsonb_build_object('email', r.role_email)::text, true);
    execute 'set local role authenticated';

    begin
      select count(*)::text into titulaires_vus
        from public.titulaires;
    exception when others then
      titulaires_vus := 'refus ' || sqlerrm;
    end;

    begin
      select (((storage.foldername(chemin))[1]
                 is distinct from 'proprietaires'
               or public.is_admin()
               or public.is_secretaire()))::text
        into pj_proprietaires;
    exception when others then
      pj_proprietaires := 'refus ' || sqlerrm;
    end;

    begin
      select count(*)::text into pj_decisions
        from storage.objects
        where bucket_id = 'documents'
          and (storage.foldername(name))[1] = 'decisions';
    exception when others then
      pj_decisions := 'refus ' || sqlerrm;
    end;

    execute 'reset role';
    return next;
  end loop;
end $verif_068$;

select * from public.verifier_acces_068() order by qui;

-- NETTOYAGE — a lancer apres avoir lu le tableau ci-dessus.
-- La fonction n a aucune raison de rester en base : elle change de
-- role, et un objet qui fait cela ne doit pas trainer sans emploi.
--
--   drop function if exists public.verifier_acces_068();
