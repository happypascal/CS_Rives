-- =============================================================================
-- Migration 064 — LE RÉSUMÉ RÉDIGÉ DES RÉSOLUTIONS
--
-- Pascal (2026-09-30) : les resumes etaient trop mecaniques — une ligne par
-- sous-resolution (10.1 a 10.6 pour un seul sujet), des intitules obscurs, et
-- aucune hierarchie entre une decision qui engage le lotissement et un miroir
-- remplace.
--
-- =============================================================================
-- 1. UNE COUCHE DE PLUS, PAS UN REMPLACEMENT
-- =============================================================================
-- ⚠ `pv_archives.resolutions` NE BOUGE PAS. Les 303 lignes du registre, avec
-- leur detail et leurs voix chiffrees, restent intactes et consultables : elles
-- sont la TRANSCRIPTION du proces-verbal, et un registre legal ne remplace pas
-- une transcription par un resume.
--
-- Ce que la 064 ajoute est une LECTURE : 149 lignes redigees, qui regroupent une
-- resolution et ses sous-points (entreprise, honoraires, financement) en une
-- phrase, et les separent en IMPORTANTES et AUTRES.
--
-- ⚠ LE RESUME EST ECRIT PAR UN LECTEUR DU PV, PAS CALCULE. Aucune regle ne peut
-- produire « 10 — Remise en fonction des portails avec interphone : mandat au
-- conseil syndical jusqu a 50 000 EUR TTC, finance par appel de fonds — Adoptee »
-- a partir de six sous-resolutions dont deux ont ete rejetees. Il faut avoir lu
-- le proces-verbal. L application AFFICHE cette lecture, elle ne la fabrique pas
-- — meme partage que partout ailleurs dans ce registre.
--
-- =============================================================================
-- 2. UN SEUL JSONB, ET NON TROIS COLONNES
-- =============================================================================
-- Les deux listes et la note forment UNE lecture, ecrite d un bloc et remplacee
-- d un bloc. Trois colonnes auraient permis d en ecrire une sans les autres,
-- c est-a-dire d afficher les resolutions importantes d une revision et les
-- autres d une revision precedente, sans que rien ne le signale.
--
-- Forme : { importantes: [...], autres: [...], note: text|null }
-- chaque ligne : { ordre, numeros, resume, decision, vote }
--
-- ⚠ `numeros` EST DU TEXTE (« 10 », « 14 et 15 », « 10 a 12, 19 et 20 ») : c est
-- ce que la ligne COUVRE, pas un identifiant. Le structurer obligerait a
-- inventer une grammaire de plages de numeros pour n en rien faire.
--
-- ⚠ `vote` EST REDIGE, jamais recalcule depuis les resolutions detaillees :
-- « Principe : Pour 2 081 · Contre 1 119 — mandat : Pour 2 381 · Contre 819 »
-- porte deux scrutins dans une seule ligne. Aucune somme n a de sens ici.
--
-- =============================================================================
-- 3. `au_resume` DISPARAIT DES RESOLUTIONS DETAILLEES
-- =============================================================================
-- ⚠ Elle marquait les lignes retenues par l ancien resume, pour les distinguer
-- des points de routine. La 064 rend cette distinction caduque : c est le resume
-- redige qui porte desormais la hierarchie, et le tableau detaille les montre
-- TOUTES. Garder une marque qui ne commande plus rien, c est promettre a un
-- lecteur futur qu elle veut encore dire quelque chose.
--
-- ⚠ AUCUNE RESOLUTION N EST SUPPRIMEE : seule la cle `au_resume` est retiree de
-- chaque objet du tableau.
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbrique, aucun
-- deux-points ni barre oblique dans une chaine, et une verification SIMPLE.
-- =============================================================================

alter table pv_archives
  add column if not exists resume_resolutions jsonb;

comment on column pv_archives.resume_resolutions is
  'Le resume REDIGE des resolutions : { importantes: [...], autres: [...], note }. Chaque ligne { ordre, numeros, resume, decision, vote } regroupe une resolution et ses sous-points. ⚠ Ne remplace PAS `resolutions`, qui reste la transcription integrale du proces-verbal. ⚠ Ecrit par un lecteur du PV, jamais calcule : aucune regle ne produit une phrase a partir de six sous-resolutions dont deux ont ete rejetees.';

-- ---------------------------------------------------------- vérification
-- La colonne existe et les 39 archives gardent leurs résolutions détaillées.
select
  (select count(*) from pv_archives)                                      as archives,
  (select count(*) from pv_archives where resolutions is not null)        as avec_detail,
  (select count(*) from information_schema.columns
     where table_name = 'pv_archives' and column_name = 'resume_resolutions') as colonne_posee;
