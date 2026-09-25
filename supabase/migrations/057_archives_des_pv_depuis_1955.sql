-- =============================================================================
-- Migration 057 — ARCHIVES DES PROCÈS-VERBAUX D ASSEMBLÉE DEPUIS 1955
--
-- Spécification de Pascal du 2026-09-25 (lot B). Un voisin a conservé TOUS les
-- proces-verbaux depuis 1955. Ils vont etre scannes. L application doit les
-- conserver et les rendre cherchables, pour que la memoire du lotissement ne
-- depende plus d un carton chez un particulier.
--
-- =============================================================================
-- 1. UN FONDS DOCUMENTAIRE, PAS DES ASSEMBLÉES
-- =============================================================================
-- ⚠ POINT CAPITAL, ET IL EST DANS LA SPECIFICATION : on ne cree PAS de lignes
-- `assemblees_generales` pour ces archives.
--
-- `assemblees_generales` porte un CYCLE DE VIE (preparation, convoquee, PV
-- envoye, cloturee), des resolutions, des votes, des m2 et des comptes. Y verser
-- soixante-dix ans d assemblees fantomes ferait apparaitre dans les ecrans de
-- gestion des assemblees sans resolution, sans budget et sans quorum — et le
-- calcul des budgets consolides compterait des enveloppes qui n existent pas.
--
-- Les archives sont donc un fonds SEPARE, en lecture, relie FACULTATIVEMENT a
-- une AG de l application quand elle existe (`assemblee_id`, nullable). Meme
-- raisonnement que `mandats_cs.ag_id` (051) : on ne fabrique pas une AG fictive
-- pour satisfaire une cle etrangere.
--
-- =============================================================================
-- 2. `annee` OBLIGATOIRE, `date_ag` FACULTATIVE
-- =============================================================================
-- Sur un document de 1957, le jour est souvent illisible ou absent ; l annee,
-- elle, se lit toujours. Exiger la date complete obligerait a INVENTER un jour
-- pour ranger le document — dans un registre legal, c est exactement ce qu on ne
-- fait pas. L annee suffit a classer, la date precise se saisit quand on la sait.
--
-- =============================================================================
-- 3. LE TEXTE OCÉRISÉ SERT À CHERCHER, JAMAIS À CITER
-- =============================================================================
-- ⚠ `texte_ocr` est le resultat d une reconnaissance de caracteres sur du papier
-- de 1955 : il est APPROXIMATIF, et il le restera. Il n a qu un usage — retrouver
-- le document. C est le SCAN qui fait foi. L ecran le dit explicitement, et il
-- doit continuer de le dire.
--
-- ⚠ ÉCART ASSUME AVEC LA SPECIFICATION : elle proposait un index GIN sur une
-- EXPRESSION `to_tsvector(...)`. Un index d expression n est pas interrogeable
-- par PostgREST, qui ne sait filtrer que des COLONNES — la recherche depuis
-- l application aurait donc exige une fonction RPC dediee, ou un index jamais
-- utilise. On materialise donc le vecteur dans une colonne GENEREE : meme
-- contenu, meme index, mais interrogeable directement. `to_tsvector(regconfig,
-- text)` est immutable, ce qui autorise la colonne generee.
--
-- =============================================================================
-- 4. IDEMPOTENCE PAR EMPREINTE DU FICHIER
-- =============================================================================
-- Un meme scan reimporte ne doit pas creer de doublon. La cle n est ni le nom de
-- fichier (il se renomme) ni la date (deux PV peuvent partager une annee) mais
-- le CONTENU : une empreinte SHA-256, rangee dans `document` et rendue unique
-- par un index. C est la base qui refuse le doublon, pas seulement le script.
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbrique, aucun
-- deux-points ni barre oblique dans une chaine, et une verification SIMPLE.
-- =============================================================================

create table if not exists pv_archives (
  id            uuid primary key default gen_random_uuid(),
  -- Null quand la date exacte est illisible. L annee, elle, est toujours connue.
  date_ag       date,
  annee         integer not null,
  type_ag       text,
  intitule      text not null,
  lieu          text,
  syndic        text,
  resume        text,
  mots_cles     text[],
  -- {path,name,type,size,sha256} — le fichier vit dans le bucket prive
  -- `documents`, sous le prefixe `pv-archives/<annee>/`. Meme convention que
  -- les autres pieces jointes : on stocke un CHEMIN, jamais une URL.
  document      jsonb not null,
  nb_pages      integer,
  texte_ocr     text,
  source        text,
  qualite       text,
  assemblee_id  uuid references assemblees_generales(id),
  commentaire   text,
  cree_par      uuid references membres_cs(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table pv_archives drop constraint if exists pv_archives_type_check;
alter table pv_archives
  add constraint pv_archives_type_check
  check (type_ag is null or type_ag in ('AGO','AGE','reunion_syndicat','inconnu'));

alter table pv_archives drop constraint if exists pv_archives_qualite_check;
alter table pv_archives
  add constraint pv_archives_qualite_check
  check (qualite is null or qualite in ('bonne','moyenne','illisible_partiel'));

-- ⚠ Bornes de l annee : 1955 est la creation du lotissement, rien ne peut lui
-- etre anterieur. La borne haute empeche une faute de frappe (19555, 2955) de
-- se ranger silencieusement a la fin de la frise.
alter table pv_archives drop constraint if exists pv_archives_annee_check;
alter table pv_archives
  add constraint pv_archives_annee_check
  check (annee between 1955 and 2100);

-- ⚠ Coherence entre les deux dates : une date complete qui ne tombe pas dans son
-- annee de classement rangerait le document a un endroit et l afficherait a un
-- autre.
alter table pv_archives drop constraint if exists pv_archives_annee_coherente;
alter table pv_archives
  add constraint pv_archives_annee_coherente
  check (date_ag is null or extract(year from date_ag) = annee);

comment on column pv_archives.texte_ocr is
  'Texte reconnu automatiquement. APPROXIMATIF sur les documents anciens. Sert a CHERCHER, jamais a citer. Le scan fait foi.';

comment on column pv_archives.assemblee_id is
  'Lien FACULTATIF vers une AG de l application. Les assemblees anterieures a l application n y figurent pas et n y figureront jamais.';

-- ------------------------------------------------- recherche plein texte
-- Colonne GENEREE plutot qu index d expression : PostgREST ne sait interroger
-- que des colonnes (cf. point 3).
--
-- ⚠ L EXPRESSION DIRECTE EST REFUSEE PAR POSTGRES — essayee, et rejetee avec
-- « generation expression is not immutable » (2026-09-25). Une colonne generee
-- exige une expression IMMUTABLE, et deux elements de celle-ci ne le sont pas :
--   - `array_to_string` est declaree STABLE, parce qu elle passe par la fonction
--     de sortie du type d element, qui n est pas immutable dans le cas general ;
--   - `to_tsvector` avec une configuration donnee en litteral depend de la
--     resolution du nom, donc du search_path.
--
-- On enveloppe donc dans une fonction declaree immutable. La promesse est SURE
-- ici, et c est ce qui la rend acceptable :
--   - la configuration est FIGEE (`french`), plus aucune dependance au reglage
--     de la base ni au search_path ;
--   - les deux FONCTIONS sont qualifiees par `pg_catalog`, donc rien ne peut les
--     masquer depuis un autre schema. ⚠ `coalesce` ne l est PAS et ne doit pas
--     l etre : c est une construction du langage, pas une fonction — la
--     qualifier est une erreur de syntaxe, et rien ne peut la masquer ;
--   - `mots_cles` est un `text[]` : la sortie de `array_to_string` y est
--     parfaitement deterministe.
-- Sans ces trois points, marquer la fonction immutable corromprait l index en
-- silence le jour ou le resultat changerait a donnees egales.
create or replace function pv_archives_vecteur(
  p_intitule text, p_resume text, p_mots text[], p_texte text
) returns tsvector
language sql immutable parallel safe
as $vecteur$
  select pg_catalog.to_tsvector('french'::pg_catalog.regconfig,
    coalesce(p_intitule, '') || ' ' ||
    coalesce(p_resume, '') || ' ' ||
    coalesce(pg_catalog.array_to_string(p_mots, ' '), '') || ' ' ||
    coalesce(p_texte, ''))
$vecteur$;

-- `drop` avant `add` : la premiere tentative a pu laisser la table sans colonne,
-- et `add column if not exists` ne corrigerait pas une colonne posee autrement.
alter table pv_archives drop column if exists recherche;

alter table pv_archives
  add column recherche tsvector
  generated always as (pv_archives_vecteur(intitule, resume, mots_cles, texte_ocr)) stored;

create index if not exists pv_archives_recherche_idx on pv_archives using gin (recherche);
create index if not exists pv_archives_annee_idx on pv_archives (annee desc);

-- ------------------------------------------------------- idempotence
-- Une empreinte par fichier. `is not null` : les lignes saisies a la main sans
-- empreinte ne se genent pas entre elles.
create unique index if not exists pv_archives_empreinte_idx
  on pv_archives ((document ->> 'sha256'))
  where (document ->> 'sha256') is not null;

-- =============================================================================
-- RLS
-- =============================================================================
-- Lecture par TOUS les membres, comme la memoire du lotissement (045) : c est la
-- memoire commune du conseil, la cacher recreerait le probleme qu elle resout.
-- ⚠ Ce n est PAS le registre des proprietaires : un PV nomme des personnes, mais
-- il a ete adresse en son temps a tous les colotis.
--
-- ECRITURE : le president et le secretaire. Le chemin normal reste le script
-- d import ; l ecran ne sert qu a completer les metadonnees d un document dont
-- la date ou le type n ont pas pu etre deduits du nom de fichier.
alter table pv_archives enable row level security;

drop policy if exists "read_auth" on pv_archives;
create policy "read_auth" on pv_archives
  for select to authenticated using (true);

drop policy if exists "pv_archives_bureau_write" on pv_archives;
create policy "pv_archives_bureau_write" on pv_archives
  for all to authenticated
  using (is_admin() or is_secretaire())
  with check (is_admin() or is_secretaire());

-- ---------------------------------------------------------- vérification
-- La table existe, elle est vide, la recherche est en place.
select
  (select count(*) from pv_archives)                              as archives,
  (select count(*) from pg_indexes
     where tablename = 'pv_archives')                              as index_poses,
  (select count(*) from pg_policies
     where tablename = 'pv_archives')                              as policies;
