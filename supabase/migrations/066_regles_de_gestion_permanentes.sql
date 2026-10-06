-- =============================================================================
-- Migration 066 — RÈGLES DE GESTION PERMANENTES adoptées en assemblée
--
-- Demande de Pascal (2026-10-06) : « les règles de gestion adoptées en AG qui
-- doivent perdurer dans le temps. Par exemple la visite avec le syndic du
-- lotissement pour la vérification des haies et la mise en demeure de 1 mois
-- pour tailler, mais il y en a certainement d autres. »
--
-- Le fonds les contient DÉJÀ, éparpillées : le constat annuel des haies est la
-- résolution 28 de 2025, le constat d huissier avant travaux vient de 2009 et
-- 2014, les intérêts de retard de plein droit et le barème de recouvrement des
-- résolutions 13 et 14 de 2026, la non-restitution du fonds de travaux à la
-- mutation de la résolution 10 de 2026. Retrouver chacune suppose aujourd hui
-- de relire trente-huit procès-verbaux.
--
-- =============================================================================
-- 1. POURQUOI UNE TABLE, ET PAS UN SUJET DE LA MÉMOIRE
-- =============================================================================
-- ⚠ CE N EST NI UNE DÉCISION, NI UN SUJET, NI UNE RÉSOLUTION.
--
--   `decisions`        une délibération du conseil, datée, qui se clôt.
--   `sujets` (045)     le fil d un dossier qui traverse les années, et son
--                      POURQUOI. Un dossier se referme un jour.
--   `resolutions_ag`   ce qu une assemblée a voté CE jour-là.
--   `regles_gestion`   ce qui, une fois voté, S APPLIQUE ENCORE AUJOURD HUI.
--
-- La différence porte sur une seule question : est-ce encore en vigueur ? Une
-- résolution de 2009 reste vraie comme fait voté, et c est pour cela qu elle ne
-- dit pas si elle s applique encore. Une règle, elle, doit pouvoir être
-- ABROGÉE sans que son vote d origine cesse d avoir eu lieu.
--
-- ⚠ ON NE DÉPLACE RIEN. La résolution d origine reste où elle est, dans
-- `pv_archives.resolutions` ou dans `resolutions_ag` : la règle la CITE. Même
-- raisonnement que le fonds de PV (057), qui ne crée aucune assemblée fantôme.
--
-- =============================================================================
-- 2. LA SOURCE EST CITÉE EN TOUTES LETTRES, ET LE LIEN EST FACULTATIF
-- =============================================================================
-- ⚠ `source_annee` + `source_reference` (texte) sont le coeur de la table, et
-- les deux clés étrangères sont NULLABLES. Trois raisons, toutes rencontrées :
--   - la règle de 1991 sur les fossés vient d une assemblée qui ne figure pas
--     dans `assemblees_generales` et n y figurera jamais ;
--   - elle peut venir d un procès-verbal non encore scanné ;
--   - une règle peut avoir été REPRISE par plusieurs assemblées (l obligation
--     de tailler les haies est rappelée en 2012, 2014 et 2019) : la citation
--     littérale dit laquelle fait foi, une clé étrangère obligerait à choisir.
--
-- Même patron exactement que `mandats_cs.ag_id` nullable + `ag_libelle` texte
-- (051) : on ne fabrique pas une assemblée pour satisfaire une contrainte.
--
-- =============================================================================
-- 3. LE DÉLAI EST DU TEXTE, PAS UN NOMBRE DE JOURS
-- =============================================================================
-- ⚠ Les formes réellement rencontrées dans les PV : « mise en demeure d un
-- mois », « sous 90 jours », « à compter du 91e jour après notification »,
-- « dès que le retard excède 120 jours après la 1re relance », « avant le
-- 31 octobre ». Les ramener à un entier obligerait à choisir un point de
-- départ que le procès-verbal ne donne pas toujours.
--
-- ⚠ ET SURTOUT : L APPLICATION NE CALCULE AUCUNE ÉCHÉANCE. Elle ne saura pas
-- dire que la taille est due le 12 mai. Afficher une date que personne n a
-- constatée, dans un registre légal, serait exactement la faute que ce projet
-- s interdit partout ailleurs. La règle est RAPPELÉE, elle n est pas armée.
-- Même raison pour `periodicite`, qui est un libellé que l oeil lit, pas une
-- récurrence qu un planificateur exécute.
--
-- =============================================================================
-- 4. CATÉGORIE ET PÉRIODICITÉ LIBRES, SANS CONTRAINTE DE VALEUR
-- =============================================================================
-- Même choix qu en 031 (catégorie des pièces jointes) et 045 (catégorie des
-- sujets) : une valeur imprévue ne doit pas exiger une migration. Les libellés
-- vivent dans `src/lib/regleLogic.js`, versionnés avec le code.
--
-- =============================================================================
-- 5. CE QUI EST STOCKÉ, CE QUI NE L EST PAS
-- =============================================================================
-- ⚠ `statut` EST STOCKÉ, et c est volontaire. Il ne se dérive de rien : une
-- règle cesse de s appliquer parce qu une assemblée l a décidé, pas parce
-- qu une date est passée. Une règle de 1968 sur la date de l assemblée est
-- caduque depuis les statuts de 2026 ; aucune donnée ne le dit, il faut
-- l inscrire.
--
-- ⚠ AUCUNE COLONNE « derniere_application ». Elle inviterait à cocher une
-- visite qui n a peut-être pas eu lieu, et le registre affirmerait un constat
-- que personne n a fait. Le suivi d un fait daté a déjà son emplacement : la
-- chronologie d un sujet (045) ou le journal d un projet (029).
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbrique, aucun
-- deux-points ni barre oblique dans une chaine, et une verification SIMPLE.
-- =============================================================================

create table if not exists regles_gestion (
  id               uuid primary key default gen_random_uuid(),

  -- Ce qui se lit dans une liste. Court, et nommant la REGLE, jamais la
  -- question posée — leçon de l intitulé fautif de 2008.
  titre            text not null,
  -- La règle telle qu elle s applique, rédigée. C est ce qu on vient chercher.
  enonce           text not null,

  -- Libres, sans contrainte : une valeur neuve ne doit pas coûter une migration.
  categorie        text,
  -- « annuelle », « a chaque mutation », « avant tous travaux », « permanente ».
  -- Un LIBELLÉ, pas une récurrence exécutée par un planificateur.
  periodicite      text,
  -- « mise en demeure d un mois », « 90 jours », « 91e jour apres notification ».
  delai            text,
  -- Qui doit agir : le syndic, le conseil syndical, chaque coloti, l assemblée.
  qui             text,

  -- LA SOURCE. L année est connue même quand rien d autre ne l est.
  source_annee     integer,
  -- Citée en toutes lettres, telle qu elle se lit au procès-verbal.
  source_reference text,
  -- Liens FACULTATIFS, jamais obligatoires (cf. section 2).
  pv_archive_id    uuid references pv_archives(id) on delete set null,
  ag_id            uuid references assemblees_generales(id) on delete set null,

  -- en_vigueur | suspendue | abrogee. Stocké, jamais dérivé (section 5).
  statut           text not null default 'en_vigueur',
  -- Quand et par quoi : « statuts du 15 septembre 2026 », « resolution 12 ».
  fin_le           date,
  fin_reference    text,

  -- Les réserves : ce qui est incertain, contredit, ou resté sans suite.
  commentaire      text,
  -- Pièces jointes, même convention que partout ailleurs (012).
  documents        jsonb not null default '[]'::jsonb,

  cree_par         uuid references membres_cs(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Le statut ne peut pas prendre une valeur inventée : il COMMANDE l affichage
-- (en vigueur ou non), contrairement à la catégorie qui ne commande rien.
alter table regles_gestion
  drop constraint if exists regles_gestion_statut_check;
alter table regles_gestion
  add constraint regles_gestion_statut_check
  check (statut in ('en_vigueur', 'suspendue', 'abrogee'));

-- ⚠ Une règle qui n est plus en vigueur DOIT dire par quoi. Sans cela, le
-- registre afficherait une règle morte sans que personne puisse retrouver
-- l acte qui l a tuée — et un lecteur futur la croirait abrogée par erreur.
alter table regles_gestion
  drop constraint if exists regles_gestion_fin_motivee;
alter table regles_gestion
  add constraint regles_gestion_fin_motivee
  check (statut = 'en_vigueur' or fin_reference is not null);

create index if not exists regles_gestion_statut_idx on regles_gestion (statut);
create index if not exists regles_gestion_annee_idx  on regles_gestion (source_annee);

-- `updated_at` suit les modifications, comme partout.
create or replace function regles_gestion_touch()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists trg_regles_gestion_touch on regles_gestion;
create trigger trg_regles_gestion_touch
  before update on regles_gestion
  for each row execute function regles_gestion_touch();

-- ---------------------------------------------------------- RLS
-- ⚠ LUE PAR TOUS LES MEMBRES, ÉCRITE PAR LE BUREAU — exactement le régime du
-- fonds de PV (057) et de la mémoire (045), et pour la même raison : ces règles
-- ont été votées en assemblée et adressées à tous les colotis, elles ne sont
-- pas des données personnelles. Ce n est PAS le registre des propriétaires.
alter table regles_gestion enable row level security;

drop policy if exists "read_auth" on regles_gestion;
create policy "read_auth" on regles_gestion
  for select to authenticated using (true);

drop policy if exists "regles_gestion_bureau_write" on regles_gestion;
create policy "regles_gestion_bureau_write" on regles_gestion
  for all to authenticated
  using (is_admin() or is_secretaire())
  with check (is_admin() or is_secretaire());

-- ⚠ AUCUNE POLICY DE STORAGE À AJOUTER — vérifié, pas supposé.
-- `documents_insert_membre` (012) ouvre à tout membre actif et n exclut que les
-- décisions enregistrées ; `documents_brouillon_prive` (026) ne vise que le
-- préfixe decisions. Le préfixe employé ici est regles.

-- ---------------------------------------------------------- vérification
-- La table existe, elle est vide, ses deux contraintes sont posées.
select
  (select count(*) from regles_gestion)                    as regles,
  (select count(*) from pg_indexes
     where tablename = 'regles_gestion')                   as index_poses,
  (select count(*) from pg_constraint
     where conrelid = 'regles_gestion'::regclass
       and contype = 'c')                                  as contraintes;
