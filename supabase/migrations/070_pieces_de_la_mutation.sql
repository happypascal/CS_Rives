-- =====================================================================
-- Migration 070 — LA PIECE QUI PROUVE LA MUTATION
--
-- L assistant de mutation du 31 octobre 2026 demande, comme le brief du
-- 22 octobre l annonce, « l attestation du notaire en piece jointe ».
-- Il n existe aujourd hui AUCUN endroit pour la ranger.
--
-- =====================================================================
-- 1. CE QUI EXISTE DEJA, ET POURQUOI CA NE SUFFIT PAS
-- =====================================================================
-- `proprietaires.acte_transmis_le` et `acte_observations` (059) suivent
-- le titre que chaque coloti adresse AU NOTAIRE. Ce sont deux choses
-- differentes de celle-ci :
--   - la 059 enregistre ce que Me Garnier communique, l application ne
--     recoit aucun acte ;
--   - elle porte une DATE, pas un fichier.
-- Les confondre ferait dire au registre que le notaire a recu un titre
-- parce que le conseil a range un acte de vente dans l application.
--
-- ⚠ ET SURTOUT PAS `titulaires.designation_documents` (068). Ce champ
-- porte la designation du representant d une indivision — l ecrit de
-- l article 6. Y deposer un acte de vente ferait porter a une colonne
-- une seconde signification que son nom contredit, et c est exactement
-- la faute que la 042 a corrigee en renommant gerant en dirigeant.
--
-- =====================================================================
-- 2. SUR LA PERIODE, PAS SUR LE LOT
-- =====================================================================
-- Meme raisonnement que la 059, et il tient en une phrase : un acte de
-- vente appartient a CELUI QUI A ACHETE. Pose sur `lots`, le document
-- survivrait a la mutation suivante et la fiche du nouveau proprietaire
-- afficherait l acte de son vendeur.
--
-- Une mutation ouvre une periode neuve ; sa piece naît avec elle.
--
-- =====================================================================
-- 3. UN jsonb, COMME PARTOUT AILLEURS
-- =====================================================================
-- Meme forme que `decisions.documents` (012), `projets.documents`,
-- `assemblees_generales.documents` (031), `journal_projet.documents`
-- (050) et `titulaires.designation_documents` (068) : une liste
-- d objets { path, name, type, size }. La ligne ne garde qu un CHEMIN,
-- le fichier vit dans le bucket prive.
--
-- ⚠ Le chemin porte l id du LOT et non celui de la periode, et c est
-- voulu : au moment du depot la periode n existe pas encore — c est
-- tout l objet de l assistant, qui televerse avant d ecrire. Meme
-- convention qu en 046 (le sujet, pas l entree) et qu en 050 (le
-- projet, pas la ligne de journal).
--
-- ⚠ AUCUNE POLICY DE STORAGE A AJOUTER — verifie, pas suppose. La 068 a
-- ferme le prefixe proprietaires dans les DEUX sens
-- (`documents_proprietaires_bureau_read` et `_insert`, restrictives) :
-- l acte de vente d un coloti y tombe donc deja sous le meme regime que
-- la designation d un indivisaire.
--
-- ⚠ AUCUNE POLICY DE TABLE non plus : `proprietaires_bureau` (035) est
-- un `for all`, et la RLS restreint les LIGNES, pas les colonnes.
--
-- =====================================================================
-- 4. CE QUI N EST PAS FAIT
-- =====================================================================
-- ⚠ PAS DE CATEGORIE sur la piece, contrairement aux pieces jointes
-- d AG (031). La periode n en porte qu une sorte : le titre qui
-- l ouvre. Une categorie inviterait a ranger ici des courriers, qui
-- ont leur place dans la memoire du lotissement (045).
--
-- ⚠ RIEN N EST OBLIGATOIRE. Les 50 periodes en cours sont nees sans
-- piece, et vingt-quatre colotis n ont pas encore transmis leur titre :
-- exiger un fichier interdirait d enregistrer une vente dont l acte
-- arrive trois semaines plus tard, alors que l article 22 donne quinze
-- jours pour DECLARER la mutation.
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide,
-- aucun argument de formatage de `raise`, aucun guillemet dollar
-- imbrique, aucun deux-points ni barre oblique dans une chaine, aucune
-- apostrophe dans un commentaire, aucune ligne de plus de 72 colonnes.
-- =====================================================================

alter table proprietaires
  add column if not exists documents jsonb not null default '[]'::jsonb;

comment on column proprietaires.documents is
  'Pieces qui prouvent cette periode de propriete — acte de vente, acte de donation, acte de notoriete. Liste d objets avec path, name, type et size ; le fichier vit dans le bucket prive documents, sous le prefixe proprietaires ferme au bureau par la 068. Ce n est PAS le suivi des titres adresses au notaire, qui est porte par acte_transmis_le (059).';

-- ------------------------------------------------------ verification
-- La colonne existe, elle est bien a la liste vide partout, et les deux
-- policies de Storage que cette colonne suppose sont toujours en place.
select
  (select count(*) from proprietaires)              as periodes,
  (select count(*) from proprietaires
     where documents = '[]'::jsonb)                 as sans_piece,
  (select count(*) from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and policyname like 'documents_proprietaires_bureau%')
                                                    as policies_storage;
