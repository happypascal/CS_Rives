-- =============================================================================
-- Migration 054 — PARAMÈTRES de l'application, total des m² du lotissement,
--                 et m² des votes d'AG (participation + répartition)
--
-- Demande de Pascal (2026-09-16) : « dans l'entête de l'AG, si on rentre le nb de
-- m² présents ou représentés, il faudrait alors calculer le %. Le nombre de m²
-- totaux est 104646. On va le mettre dans les paramètres de l'app car il y a
-- 7 colotis qui ont demandé à sortir et ce total pourrait changer. MAIS IL NE FAUT
-- PAS QUE ÇA CHANGE LES % DE PARTICIPATION. […] On peut aussi entrer
-- optionnellement les m² et calculer le % de approuvé, refusé, abstention. »
-- (Portée des % confirmée par Pascal : les RÉSOLUTIONS D'AG, pas les décisions du CS.)
--
-- =============================================================================
-- 1. LA PHRASE QUI COMMANDE TOUTE CETTE MIGRATION
-- =============================================================================
-- « Il ne faut pas que ça change les % de participation. »
--
-- Un pourcentage calculé à la volée sur un total STOCKÉ AILLEURS est une bombe à
-- retardement : le jour où sept colotis sortent et où le total passe de 104 646 à
-- 96 000, TOUTES les AG déjà tenues verraient leur taux de participation changer
-- tout seul. Une assemblée réputée avoir réuni 52 % en afficherait 57 % deux ans
-- plus tard — dans un registre légal, sur un chiffre qui conditionne la validité
-- des délibérations. Personne n'aurait rien fait, et le registre mentirait.
--
-- D'où `assemblees_generales.m2_total` : le total TEL QU'IL ÉTAIT le jour de
-- l'assemblée, figé sur la ligne. Exactement le patron de `composition_snapshot`
-- sur les décisions, qui garde le PDF fidèle après un changement de mandat. Le
-- paramètre donne la valeur COURANTE, il sert à pré-remplir ; c'est la colonne de
-- l'AG qui fait foi ensuite.
--
-- ⚠ Ne jamais « simplifier » en calculant le pourcentage sur le paramètre.
--
-- =============================================================================
-- 2. POURQUOI UNE TABLE `parametres` ET PAS UNE CONSTANTE DANS LE CODE
-- =============================================================================
-- Le total doit pouvoir changer sans redéploiement : sept colotis ont demandé à
-- sortir, et l'issue n'est pas connue. Une constante dans `config.js` obligerait à
-- une modification de code pour un chiffre qui est une donnée, pas du logiciel.
--
-- ⚠ POURQUOI PAS LA SOMME DES `lots.superficie`, qui existe déjà. Deux raisons, et
-- la seconde est rédhibitoire :
--   1. le registre des propriétaires est INCOMPLET par construction (l'écran le dit
--      lui-même : « tant que le registre est incomplet, les parts sont provisoires ») ;
--   2. `lots` n'est lisible QUE du président et du secrétaire (migration 035). Un
--      trésorier ou un membre ordinaire consultant une AG ne pourrait pas calculer
--      le pourcentage — il verrait un trou là où les autres voient un chiffre. Le
--      taux de participation d'une assemblée n'est pas une donnée personnelle : il
--      figure au procès-verbal, que tout coloti reçoit.
--
-- Table clé/valeur, volontairement générique : le prochain paramètre n'exigera pas
-- de migration. `valeur` en TEXT — une table de paramètres qui typerait ses valeurs
-- aurait une colonne par type, ou un type par paramètre ; la lecture convertit.
--
-- =============================================================================
-- 3. LES m² DES VOTES : ON ENREGISTRE, ON NE DÉCIDE PAS
-- =============================================================================
-- L'AG vote au prorata des superficies. Jusqu'ici l'application n'enregistrait que
-- le RÉSULTAT (`statut`), le détail restant au PV. Elle peut désormais recevoir les
-- m² pour / contre / abstention, et en afficher les pourcentages.
--
-- ⚠ CE QUE ÇA NE FAIT PAS, ET NE DOIT PAS FAIRE : décider. `statut` reste posé À LA
-- MAIN, et `majorite_requise` reste un libellé qu'AUCUNE logique n'applique. Rien
-- ne calcule l'adoption d'une résolution à partir de ces m². Deux raisons :
--   - les règles de majorité d'une AG (simple, absolue, double majorité qualifiée)
--     ne se ramènent pas toutes au même dénominateur, et les statuts sont EN COURS
--     DE RÉVISION — coder aujourd'hui une majorité qu'on n'a pas lue, c'est coder
--     une règle fausse ;
--   - le décompte fait foi au procès-verbal, signé. L'application le CONSTATE.
-- Le jour où quelqu'un voudra en déduire l'adoption, qu'il relise ce paragraphe et
-- les statuts alors en vigueur, dans cet ordre.
--
-- ⚠ Les trois colonnes sont NULLABLES et indépendantes : une AG ancienne dont le PV
-- ne donne pas le détail ne doit pas devenir impossible à saisir. Nul veut dire
-- « non renseigné », jamais « zéro m² ».
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbriqué, aucun
-- deux-points ni barre oblique dans une chaine, et une vérification SIMPLE.
-- =============================================================================

-- ------------------------------------------------------- paramètres de l'app
create table if not exists parametres (
  cle        text primary key,
  valeur     text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references membres_cs(id) on delete set null
);

comment on table parametres is
  'Reglages de l application modifiables sans redeploiement. Valeurs en texte, converties a la lecture.';

alter table parametres enable row level security;

-- Lecture par tout membre connecte : le total des m2 sert a afficher un taux de
-- participation, qui figure au proces-verbal. Ce n est pas une donnee personnelle.
drop policy if exists "read_auth" on parametres;
create policy "read_auth" on parametres for select to authenticated using (true);

drop policy if exists "write_admin" on parametres;
create policy "write_admin" on parametres
  for all to authenticated using (is_admin()) with check (is_admin());

-- Valeur de depart, donnee par Pascal le 2026-09-16.
insert into parametres (cle, valeur)
values ('m2_total_lotissement', '104646')
on conflict (cle) do nothing;

-- ------------------------------------------- total figé sur chaque assemblée
alter table assemblees_generales
  add column if not exists m2_total numeric(10,2);

comment on column assemblees_generales.m2_total is
  'Total des m2 du lotissement TEL QU IL ETAIT le jour de cette assemblee. Fige, comme composition_snapshot sur une decision : le taux de participation ne doit pas bouger si le total change ensuite.';

-- Reprise : les assemblees qui portent deja des m2 presents recoivent le total
-- connu aujourd hui. ⚠ Aucun coloti n est encore sorti a cette date, la valeur est
-- donc la bonne pour toutes. Si une assemblee ancienne avait un autre total, il se
-- corrige a la main sur sa fiche.
update assemblees_generales
set m2_total = 104646
where m2_presents is not null and m2_total is null;

-- --------------------------------------------- m² des votes par résolution
alter table resolutions_ag
  add column if not exists m2_pour       numeric(10,2),
  add column if not exists m2_contre     numeric(10,2),
  add column if not exists m2_abstention numeric(10,2);

comment on column resolutions_ag.m2_pour is
  'm2 ayant vote POUR. Facultatif. Sert a AFFICHER des pourcentages, jamais a calculer l adoption : statut reste pose a la main.';

-- ---------------------------------------------------------- vérification
-- Le parametre existe, et les AG deja dotees de m2 presents ont leur total fige.
select
  (select valeur from parametres where cle = 'm2_total_lotissement')            as m2_total_parametre,
  (select count(*) from assemblees_generales where m2_presents is not null)     as ag_avec_presents,
  (select count(*) from assemblees_generales
     where m2_presents is not null and m2_total is null)                        as ag_sans_total_fige;
