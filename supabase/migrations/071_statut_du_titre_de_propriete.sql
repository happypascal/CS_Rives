-- =====================================================================
-- Migration 071 — LE STATUT DU TITRE DE PROPRIETE
--
-- Pascal, 1er novembre 2026 :
--   « Il faut ajouter un statut pour le transfert des titres de
--     propriete. La liste de Me Garnier est fausse. Il y a des colotis
--     qui m ont ecrit pour me dire qu ils l avaient envoye. Donc un
--     statut a verifier en plus d envoye et pas envoye. »
--   puis, le meme jour : « il faut ajouter le statut incomplet ».
--
-- =====================================================================
-- 1. CE QUE LA 059 SAVAIT DIRE, ET CE QU ELLE NE SAVAIT PAS
-- =====================================================================
-- La 059 ne porte qu une DATE, `acte_transmis_le` : celle que Me
-- Garnier communique quand il a recu un titre. Elle n a donc que deux
-- etats, et le second est un silence — pas de date, donc rien.
--
-- Or ce silence recouvrait DEUX situations opposees, et la date seule
-- en melangeait deux autres. Il y en a QUATRE :
--   - le coloti n a rien envoye ;
--   - le coloti affirme avoir envoye, et l etat du notaire ne le montre
--     pas ;
--   - le notaire a recu une piece, mais elle ne suffit pas — il manque
--     par exemple l acquisition d origine ;
--   - le titre est recu et complet.
--
-- ⚠ LES DEUX DU MILIEU ETAIENT INVISIBLES. Un titre incomplet portait
-- une date de reception, donc comptait comme recu : le registre
-- affirmait que le dossier etait clos alors que l etude attend encore
-- une piece. C est le cas d au moins un coloti connu du conseil.
--
-- ⚠ LES CONFONDRE FAIT RELANCER QUELQU UN QUI A DEJA FAIT CE QU ON LUI
-- DEMANDE. C est exactement ce qui vient de se produire : la campagne
-- du 30 octobre est partie vers 23 colotis dont certains avaient deja
-- adresse leur titre. Devant une recherche facturee 100 euros au
-- proprietaire (resolution n 15 de l AG 2026), ce n est pas un detail
-- de presentation.
--
-- =====================================================================
-- 2. UN STATUT, ET NON UNE SECONDE DATE A COTE
-- =====================================================================
-- ⚠ ARBITRAGE EXPRES DE PASCAL, contre la proposition initiale. Il
-- avait ete propose de garder deux colonnes separees — ce que le
-- NOTAIRE constate, ce que le COLOTI declare — au motif que deux
-- sources qui se contredisent ne doivent pas etre fondues.
--
-- Pascal a tranche l inverse, et pour une raison qui porte : ce
-- registre doit produire un TABLEAU A RENVOYER A L ETUDE. Une colonne
-- qui se lit
-- en un mot vaut mieux, pour cet usage, que deux colonnes dont le
-- lecteur doit faire la synthese lui-meme. Le statut est donc STOCKE.
--
-- ⚠ ET IL N EST PAS DERIVE, contrairement a la doctrine habituelle du
-- depot (statut de projet, tantieme, est_societe). La raison est qu il
-- n y a RIEN D OU LE DERIVER : « a verifier » est un constat que seul
-- le conseil peut poser, au vu d un courriel ou d un appel. Aucune
-- colonne ne le contient.
--
-- =====================================================================
-- 3. LA DATE DE DECLARATION RESTE, ET ELLE SERT AU TABLEAU
-- =====================================================================
-- `acte_declare_le` n est pas un second statut : c est la PRECISION du
-- statut « a verifier », exactement comme `acte_transmis_le` precise
-- « recu ». Sans elle, le tableau adresse au notaire dirait « a
-- verifier » sans dire depuis quand — or « le coloti declare avoir
-- envoye le 12 octobre » est une information qu il peut recouper, et
-- « a verifier » tout court n en est pas une.
--
-- Meme doctrine que la 059 : une DATE plutot qu une case.
--
-- =====================================================================
-- 4. LA COHERENCE EST TENUE PAR UNE CONTRAINTE
-- =====================================================================
-- ⚠ DEUX COLONNES QUI DISENT LA MEME CHOSE FINISSENT PAR SE
-- CONTREDIRE. Si le notaire a communique une date de reception, le
-- statut ne peut pas dire autre chose que « recu » : la contrainte
-- `proprietaires_acte_statut_coherent` le refuse. Sans elle, une fiche
-- aurait pu porter une date de reception ET le statut « pas envoye »,
-- et rien ne l aurait signale.
--
-- ⚠ L INVERSE EST PERMIS : « recu » sans date. On peut apprendre qu un
-- titre est arrive sans savoir quel jour — exiger la date obligerait a
-- en inventer une.
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide,
-- aucun argument de formatage de `raise`, aucun guillemet dollar
-- imbrique, aucun deux-points ni barre oblique dans une chaine, aucune
-- apostrophe dans un commentaire, aucune ligne de plus de 72 colonnes.
-- =====================================================================

alter table proprietaires
  add column if not exists acte_statut text not null
    default 'non_envoye',
  add column if not exists acte_declare_le date;

-- Les trois etats, et rien d autre. ⚠ Contrainte de VALEUR ici, alors
-- que le depot laisse libres les categories (031, 045, 066) : celles-la
-- sont des libelles que personne ne teste, celui-ci commande un
-- compteur, un filtre et une colonne du tableau envoye a l etude. Une
-- quatrieme valeur arrivee par surprise les ferait mentir en silence.
alter table proprietaires
  drop constraint if exists proprietaires_acte_statut_valide;
alter table proprietaires
  add constraint proprietaires_acte_statut_valide
  check (acte_statut in ('non_envoye', 'a_verifier', 'incomplet',
                         'recu'));

-- Une date de reception communiquee par le notaire interdit les deux
-- statuts qui disent le contraire. ⚠ Elle est en revanche COMPATIBLE
-- avec « incomplet » : le notaire a bien recu quelque chose ce jour-la,
-- et c est precisement ce que ce statut constate.
alter table proprietaires
  drop constraint if exists proprietaires_acte_statut_coherent;
alter table proprietaires
  add constraint proprietaires_acte_statut_coherent
  check (acte_transmis_le is null
         or acte_statut in ('recu', 'incomplet'));

-- On ne declare pas avoir envoye le titre d un bien qu on ne possede
-- pas encore. Meme garde que `proprietaires_acte_apres_acquisition`.
alter table proprietaires
  drop constraint if exists proprietaires_declaration_apres_acquisition;
alter table proprietaires
  add constraint proprietaires_declaration_apres_acquisition
  check (acte_declare_le is null or date_acquisition is null
         or acte_declare_le >= date_acquisition);

comment on column proprietaires.acte_statut is
  'Ou en est le titre de propriete de cette periode. non_envoye : rien ne nous est parvenu. a_verifier : le coloti declare avoir envoye, l etat du notaire ne le montre pas — c est une CONTRADICTION constatee, pas un doute sur sa parole. incomplet : le notaire a recu une piece mais elle ne suffit pas, il manque par exemple l acquisition d origine — le dossier n est PAS clos. recu : Me Garnier a confirme la reception d un titre complet. STOCKE et non derive : ni a_verifier ni incomplet ne se deduisent d une autre colonne, seul le conseil peut les poser au vu d un courriel ou de l etat annote de l etude.';

comment on column proprietaires.acte_declare_le is
  'Date a laquelle le coloti declare avoir adresse son titre au notaire. Precision du statut a_verifier, jamais un statut concurrent. C est ce que le notaire peut recouper — a verifier tout court ne lui apprend rien.';

-- --------------------------------------------- reprise de l existant
-- ⚠ LES TITRES DEJA RECUS PRENNENT LE STATUT QUI LEUR CORRESPOND. Sans
-- cette reprise, les onze periodes dont Me Garnier a confirme la
-- reception repartiraient a « non envoye » et le registre affirmerait
-- que personne n a rien transmis.
-- ⚠ ELLE LES POSE A « recu » ET NON A « incomplet », alors meme qu on
-- sait qu au moins un titre est incomplet. Le registre ne peut pas
-- deviner lequel : seul l etat annote de Me Garnier le dit, et c est au
-- conseil de le reporter fiche par fiche. Poser « incomplet » partout
-- par prudence ferait affirmer un manque sur dix dossiers qui n en ont
-- aucun — une fausse alerte generalisee ne se lit plus.
update proprietaires
   set acte_statut = 'recu'
 where acte_transmis_le is not null
   and acte_statut not in ('recu', 'incomplet');

-- ---------------------------------------------------------- RLS
-- ⚠ AUCUNE POLICY A AJOUTER — verifie, pas suppose. La policy
-- `proprietaires_bureau` (035) est un `for all`, et la RLS restreint
-- les LIGNES, pas les colonnes : les deux nouvelles colonnes heritent
-- de la fermeture au president et au secretaire.

-- ------------------------------------------------------ verification
select
  acte_statut,
  count(*)                                        as periodes,
  count(acte_transmis_le)                         as avec_date_notaire,
  count(acte_declare_le)                          as avec_declaration
  from proprietaires
 where date_cession is null
 group by acte_statut
 order by acte_statut;
