-- =============================================================================
-- Migration 067 — NUMÉROTATION des règles de gestion
--
-- Demande de Pascal (2026-10-06) : « il faut numéroter les règles ». Une règle
-- se cite — en séance, dans un courrier au syndic, dans une mise en demeure —
-- et « la règle sur les haies » ne désigne rien de vérifiable.
--
-- =============================================================================
-- 1. STOCKÉ, PAS DÉRIVÉ DE L ORDRE D AFFICHAGE
-- =============================================================================
-- ⚠ Un numéro calculé au rendu changerait à chaque tri, à chaque abrogation, à
-- chaque règle ajoutée. Une règle citée « n 4 » dans un courrier doit rester la
-- n 4 dix ans plus tard. Le numéro est donc une COLONNE, posée une fois.
--
-- ⚠ ET IL NE SE RÉUTILISE JAMAIS. C est la doctrine de la numérotation des
-- décisions (034) appliquée ici : devant un registre, un numéro manquant se lit
-- comme une règle retirée, alors qu un numéro réattribué fait dire à deux textes
-- differents la meme chose. Une règle abrogée GARDE son numéro.
--
-- =============================================================================
-- 2. ATTRIBUÉ EN BASE, PAS PAR L ÉCRAN
-- =============================================================================
-- ⚠ Un max + 1 calculé côté client est faux dès que deux personnes inscrivent
-- une règle en même temps, et il l est aussi quand la liste affichée est
-- filtrée. Le trigger le pose à l insertion quand le numéro est nul, et le laisse
-- tel quel quand il est fourni — ce qui permet de reprendre une numérotation
-- existante lors d un import.
--
-- ⚠ LE NUMÉRO N EST PAS RÉSERVÉ : deux insertions simultanées peuvent viser le
-- meme numéro, l unique les départagera. Meme limite que les décisions, assumée.
--
-- =============================================================================
-- 3. L ORDRE INITIAL EST CHRONOLOGIQUE, LA SUITE NE L EST PAS
-- =============================================================================
-- ⚠ Les huit règles existantes sont numérotées par ANNÉE DE VOTE croissante :
-- le registre se lit alors dans l ordre où l association s est donné ses règles,
-- 1968 en tete. Mais une règle ancienne retrouvée demain prendra le numéro
-- SUIVANT, pas sa place chronologique — sinon il faudrait renuméroter, donc
-- rendre faux tout ce qui a été cité avant. **Le numéro dit l ordre
-- d inscription, jamais l ordre d adoption.**
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbrique, aucun
-- deux-points ni barre oblique dans une chaine, et une verification SIMPLE.
-- =============================================================================

alter table regles_gestion
  add column if not exists numero integer;

-- ---------------------------------------------------------- reprise des huit
-- ⚠ Par année de vote croissante, puis par titre pour que l ordre soit
-- deterministe. `where numero is null` : relancer la migration ne renumérote
-- rien, et c est exactement ce qu on attend d elle.
with ordonnees as (
  select id,
         row_number() over (
           order by coalesce(source_annee, 9999), titre
         ) as rang
  from regles_gestion
  where numero is null
)
update regles_gestion r
set numero = o.rang
from ordonnees o
where r.id = o.id;

-- Un numéro ne désigne qu une règle.
create unique index if not exists regles_gestion_numero_idx
  on regles_gestion (numero)
  where numero is not null;

-- ---------------------------------------------------------- attribution
-- Pose le numéro suivant quand il n est pas fourni. ⚠ `coalesce(max, 0) + 1`
-- compte sur TOUTES les lignes, abrogées comprises : le numéro d une règle
-- abrogée reste pris.
create or replace function regles_gestion_numeroter()
returns trigger
language plpgsql
as $num$
begin
  if new.numero is null then
    select coalesce(max(numero), 0) + 1 into new.numero from regles_gestion;
  end if;
  return new;
end;
$num$;

drop trigger if exists trg_regles_gestion_numeroter on regles_gestion;
create trigger trg_regles_gestion_numeroter
  before insert on regles_gestion
  for each row execute function regles_gestion_numeroter();

-- ---------------------------------------------------------- vérification
-- Toutes numérotées, aucun doublon, et la plus ancienne porte le numéro 1.
select
  (select count(*) from regles_gestion)                        as regles,
  (select count(*) from regles_gestion where numero is null)   as sans_numero,
  (select count(distinct numero) from regles_gestion)          as numeros_distincts,
  (select min(numero) from regles_gestion)                     as premier,
  (select max(numero) from regles_gestion)                     as dernier;
