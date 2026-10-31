-- =====================================================================
-- Migration 069 — LA NUMEROTATION D ORIGINE DES LOTS (1955)
--
-- Demande de Pascal, 31 octobre 2026 : « releve les numeros de lot et
-- propose ou les ranger », puis « il faut aussi ajouter un champ pour
-- le lot ».
--
-- ⚠ CE FICHIER EST ECRIT APRES COUP. Les trois colonnes ont ete posees
-- a la main dans le SQL Editor le 31 octobre, depuis un extrait donne
-- dans la conversation. Il est ecrit pour que `schema.sql` et le
-- dossier des migrations disent la meme chose que la base — sans lui,
-- une installation neuve n aurait pas ces colonnes et personne ne
-- saurait pourquoi elles existent en production.
--
-- =====================================================================
-- 1. CE QUE L ON VIENT DE RETROUVER
-- =====================================================================
-- Le cahier des charges de 1955 designe les terrains par un numero de
-- lot ET une zone (« lot n 13, zone A »). Le registre, lui, ne connait
-- que la PARCELLE cadastrale (« 0B 220 ») : la 035 note en toutes
-- lettres qu aucun document connu ne reliait cette numerotation
-- d origine aux parcelles actuelles, la seule exception etant le lot 5
-- = 0B 203, trouve en 2026 au registre des societes.
--
-- L etat annote que Me Garnier a remis le 30 octobre 2026 porte, de sa
-- main, le numero de lot de chaque parcelle dont il a recu le titre :
-- 26 correspondances, lues dans les actes eux-memes.
--
-- ⚠ LE COUPLE (zone, numero) EST UNIQUE sur ces 26, et c est ce qui
-- confirme qu il s agit bien de la numerotation de 1955 : six parcelles
-- portent le numero 4, mais chacune dans une zone differente.
--
-- =====================================================================
-- 2. POURQUOI DU TEXTE, ET PAS UN ENTIER
-- =====================================================================
-- ⚠ UNE PARCELLE PORTE DEUX LOTS. 0B 247+263 est annotee « Lot 3 et 5 »
-- — c est la parcelle qui pese 1,81 lot (038). Un entier ne peut pas
-- l exprimer, et inventer une seconde colonne pour un seul cas serait
-- pire. Le numero est donc du TEXTE, comme `presents_representes` en
-- 062 et `delai` en 066 : on transcrit ce que la source ecrit.
--
-- Deux autres raisons : l etat ecrit « Lot 09 » avec son zero, et un
-- entier inviterait a faire de ce numero une cle.
--
-- =====================================================================
-- 3. LA ZONE SORT DES OBSERVATIONS
-- =====================================================================
-- Elle y etait depuis la 035 (« la zone est en observations, faute de
-- colonne dediee »), en texte libre. Deux parcelles y melangeaient deja
-- autre chose — « Zone E, 1,19 lot » — une information qui fait doublon
-- avec `nombre_lots` et que personne ne pouvait filtrer.
--
-- ⚠ LA MIGRATION NE TOUCHE PAS `observations` : le transfert est fait
-- par un script, qui sauvegarde avant et dit ce qu il deplace. Une
-- migration qui reecrit du texte libre en masse ne se relit pas.
--
-- =====================================================================
-- 4. CE QUI N EST PAS POSE, ET POURQUOI
-- =====================================================================
-- ⚠ AUCUNE CONTRAINTE D UNICITE sur (zone, numero_origine), alors meme
-- que le couple est unique dans ce qu on connait. Trois raisons :
--   - on ne connait que 26 parcelles sur 50 ;
--   - une valeur s est DEJA revelee fausse — « Lot 6 » lu sur
--     l annotation de 0B 243, quand l acte de vente dit « lot numero
--     QUATRE (4) de la Zone E » ;
--   - « 3 et 5 » n entre dans aucun index.
-- Une contrainte promettrait ici une exactitude qu on n a pas, et
-- bloquerait la correction du jour ou une lecture se revele mauvaise.
-- Le doublon est SIGNALE a l ecran, jamais refuse — meme doctrine que
-- les divergences de mandat (051).
--
-- ⚠ `numero` RESTE LA SEULE CLE. La parcelle cadastrale est
-- l identifiant verifiable au cadastre ; le numero d origine est une
-- information historique. Rien dans le code ne doit s en servir pour
-- retrouver un lot.
--
-- ⚠ `origine_source` N EST PAS UNE DECORATION. Les 26 valeurs n ont pas
-- toutes la meme force : vingt-cinq viennent d une annotation
-- manuscrite relevee sur un scan, une vient de l acte lui-meme. Citer
-- la source en toutes lettres est ce qui permettra, dans dix ans, de
-- savoir laquelle reverifier. Meme patron que `regles_gestion`
-- (066) et que `mandats_cs.ag_libelle` (051).
--
-- ⚠ Les chaines des `comment on` restent longues a dessein — une chaine
-- repliee par un collage demeure valide, elle garde seulement un retour
-- a la ligne. Ce sont les COMMENTAIRES qui doivent tenir en 72 colonnes.
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide,
-- aucun argument de formatage de `raise`, aucun guillemet dollar
-- imbrique, aucun deux-points ni barre oblique dans une chaine, aucune
-- apostrophe dans un commentaire, aucune ligne de plus de 72 colonnes
-- (un collage depuis un terminal replie a 80 coupe les commentaires en
-- deux et leur fin redevient du code).
-- =====================================================================

alter table lots
  add column if not exists zone            text,
  add column if not exists numero_origine  text,
  add column if not exists origine_source  text;

comment on column lots.zone is
  'Zone du lotissement (A a E) au sens du cahier des charges de 1955. Etait auparavant en texte libre dans observations.';

comment on column lots.numero_origine is
  'Numero du lot dans la numerotation d origine de 1955, tel qu il se lit a l acte. TEXTE et non entier — 0B 247+263 porte deux lots (3 et 5), et l etat du notaire ecrit Lot 09 avec son zero. Unique seulement en couple avec la zone, et seulement sur ce qui est connu. N EST PAS UNE CLE — la parcelle cadastrale (numero) reste le seul identifiant.';

comment on column lots.origine_source is
  'D ou vient le numero d origine, en toutes lettres. Les sources n ont pas la meme force — une annotation manuscrite relevee sur un scan ne vaut pas la mention portee a l acte.';

-- Lire par zone puis par numero est l usage attendu (retrouver un lot
-- du cahier des charges). Pas d unicite, cf. section 4.
create index if not exists lots_origine_idx
  on lots (zone, numero_origine);

-- ---------------------------------------------------------- RLS
-- ⚠ AUCUNE POLICY A AJOUTER — verifie, pas suppose. `lots_bureau` (035)
-- est un `for all`, et la RLS restreint les LIGNES, pas les colonnes :
-- les trois nouvelles colonnes heritent de la meme fermeture au
-- president et au secretaire.

-- ------------------------------------------------------ verification
-- Les colonnes existent, et l on voit d un coup d oeil ce qui est
-- connu, sachant que 24 parcelles sur 50 restent a retrouver.
select
  (select count(*) from lots)                                as parcelles,
  (select count(*) from lots where zone is not null)         as zones,
  (select count(*) from lots where numero_origine is not null)
                                                             as numeros_origine,
  (select count(*) from pg_indexes
     where tablename = 'lots' and indexname = 'lots_origine_idx')
                                                             as index_pose;
