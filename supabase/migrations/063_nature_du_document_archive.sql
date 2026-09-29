-- =============================================================================
-- Migration 063 — LA NATURE DU DOCUMENT ARCHIVÉ
--
-- Pascal (2026-09-29) : « 1988, j ai change le nom du document car c est la
-- convocation. PV manquant. A mettre a jour. »
--
-- =============================================================================
-- 1. POURQUOI UNE COLONNE, ET PAS UN COMMENTAIRE
-- =============================================================================
-- Le fonds a ete rempli en supposant que tout document qui y entre est un
-- proces-verbal. Cette supposition vient de se reveler fausse : le document de
-- 1988 est la CONVOCATION du 1er juin, envoyee pour la seance du 2 juillet. Le
-- proces-verbal de cette assemblee, lui, n a pas ete retrouve.
--
-- ⚠ LA CONSEQUENCE N EST PAS COSMETIQUE. `anneesCouvertes` deduit les annees
-- couvertes des LIGNES du fonds, et la frise des annees manquantes s en nourrit
-- — c est la sortie la plus utile de l ecran, celle qui dit ce qu il reste a
-- scanner. Tant que 1988 porte une ligne, la frise annonce 1988 couverte, et le
-- PV manquant ne figure sur AUCUNE liste. Une archive qui se croit complete est
-- exactement le mode de panne que cette frise existe pour eviter.
--
-- ⚠ ON NE SUPPRIME PAS LA LIGNE POUR AUTANT. Une convocation de 1988 est une
-- piece d archive a part entiere : elle porte l ordre du jour d une assemblee
-- dont le PV est perdu, et c est parfois la seule trace de ce qui devait y etre
-- decide. La jeter pour faire tomber une annee dans la bonne colonne serait
-- detruire une source pour arranger un compte.
--
-- =============================================================================
-- 2. AUCUNE CONTRAINTE DE VALEUR
-- =============================================================================
-- ⚠ Meme choix qu en 031 pour la categorie des pieces jointes d AG : une nature
-- imprevue — un rapport du conseil syndical, une feuille de presence — ne doit
-- pas exiger une migration. Le defaut `pv` dit la verite de l existant : les
-- trente-quatre autres lignes sont bien des proces-verbaux.
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbrique, aucun
-- deux-points ni barre oblique dans une chaine, et une verification SIMPLE.
-- =============================================================================

alter table pv_archives
  add column if not exists type_document text not null default 'pv';

comment on column pv_archives.type_document is
  'Nature du document conserve : pv (defaut), convocation, autre. ⚠ Seuls les pv comptent dans les annees couvertes par le fonds — une convocation ne remplace pas le proces-verbal manquant, et la frise des annees a scanner doit continuer de reclamer celui-ci. Sans contrainte de valeur, comme la categorie des pieces jointes d AG (031).';

-- ---------------------------------------------------------- vérification
-- La colonne existe, les 35 archives sont intactes, et une seule est autre
-- chose qu un proces-verbal.
select
  (select count(*) from pv_archives)                                   as archives,
  (select count(*) from pv_archives where type_document = 'pv')        as proces_verbaux,
  (select count(*) from information_schema.columns
     where table_name = 'pv_archives' and column_name = 'type_document') as colonne_posee;
