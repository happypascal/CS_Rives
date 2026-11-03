-- =====================================================================
-- Migration 072 — L ENVOI CONSTATE PAR LE CONSEIL
--
-- Pascal, 3 novembre 2026 : « et un autre cas, il l a envoye apres mon
-- rappel en me mettant en copie ».
--
-- =====================================================================
-- 1. POURQUOI CE N EST PAS UN « A VERIFIER » DE PLUS
-- =====================================================================
-- Les deux etats « a verifier » reposent sur la PAROLE du coloti : il
-- nous dit avoir envoye, avec ou sans date. Le registre constate une
-- contradiction avec l etat du notaire, et c est a l etude de la lever.
--
-- Ici, le conseil a VU l envoi partir : le coloti a ecrit a l etude en
-- mettant le president en copie, apres la relance du 30 octobre. Ce n
-- est plus une declaration rapportee, c est une piece que le conseil
-- detient.
--
-- ⚠ ET LA DIFFERENCE CHANGE CE QU ON PEUT ECRIRE A ME GARNIER. Sur un
-- « a verifier », nous demandons une recherche. Sur celui-ci, nous
-- pouvons affirmer : le titre vous a ete adresse le tant, nous en avons
-- copie. Les confondre ferait perdre la seule categorie ou le conseil
-- apporte une preuve au lieu d en reclamer une.
--
-- =====================================================================
-- 2. POURQUOI UNE VALEUR STOCKEE, ALORS QUE LE CINQUIEME ETAT EST
--    DERIVE
-- =====================================================================
-- « A verifier sans date » se DEDUIT : la date est renseignee ou elle
-- ne l est pas, et ajouter une valeur pour redire cela creerait deux
-- colonnes qui portent la meme information.
--
-- ⚠ CELUI-CI NE SE DEDUIT DE RIEN. Aucune colonne du registre ne dit
-- que le conseil a recu copie du courriel. C est une information NEUVE,
-- donc elle a besoin d une place. Meme raisonnement que pour
-- « a verifier » et « incomplet » en 071 : on stocke ce qu aucun calcul
-- ne retrouve.
--
-- =====================================================================
-- 3. CE QUE LA DATE DEVIENT
-- =====================================================================
-- `acte_declare_le` porte deja la date d envoi connue du conseil. Elle
-- sert ici aussi, et c est l ECRAN qui en change le libelle : « le
-- coloti declare avoir envoye le » sur un a verifier, « envoye le
-- (copie au conseil) » sur celui-ci.
--
-- ⚠ UNE SECONDE COLONNE DE DATE SERAIT UN DOUBLON. Les deux expriment
-- la meme chose — quand le titre est parti — et seule la FORCE de notre
-- connaissance differe, ce que le statut porte deja.
--
-- =====================================================================
-- 4. CE QUI NE CHANGE PAS
-- =====================================================================
-- ⚠ `proprietaires_acte_statut_coherent` reste intacte : un envoi
-- constate n a PAS de date de reception par le notaire, puisque c est
-- justement ce que l etude n a pas encore enregistre. La contrainte
-- continue de reserver `acte_transmis_le` aux deux etats ou le notaire
-- a recu quelque chose.
--
-- ⚠ AUCUNE REPRISE DE L EXISTANT. Aucune ligne ne peut valoir
-- « envoi_constate » avant que le conseil ne le pose : la colonne est
-- deja contrainte, et personne ne l a ecrite. Contrairement a la 071,
-- il n y a donc rien a rattraper avant de contraindre.
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide,
-- aucun argument de formatage de `raise`, aucun guillemet dollar
-- imbrique, aucun deux-points ni barre oblique dans une chaine, aucune
-- apostrophe dans un commentaire, aucune ligne de plus de 72 colonnes.
-- =====================================================================

alter table proprietaires
  drop constraint if exists proprietaires_acte_statut_valide;
alter table proprietaires
  add constraint proprietaires_acte_statut_valide
  check (acte_statut in ('non_envoye', 'a_verifier', 'envoi_constate',
                         'incomplet', 'recu'));

comment on column proprietaires.acte_statut is
  'Ou en est le titre de propriete de cette periode. non_envoye : rien ne nous est parvenu. a_verifier : le coloti declare avoir envoye, l etat du notaire ne le montre pas — l ecran distingue selon qu il a indique une date ou non, ce qui se lit sur acte_declare_le et ne se stocke pas. envoi_constate : le coloti a ecrit a l etude en mettant le conseil en copie — ce n est plus une declaration rapportee mais une piece que le conseil detient. incomplet : le notaire a recu une piece mais elle ne suffit pas. recu : reception d un titre complet confirmee. STOCKE et non derive : aucun de ces etats ne se lit dans une autre colonne.';

-- ------------------------------------------------------ verification
select
  acte_statut,
  count(*)                                        as periodes,
  count(acte_transmis_le)                         as avec_date_notaire,
  count(acte_declare_le)                          as avec_date_envoi
  from proprietaires
 where date_cession is null
 group by acte_statut
 order by acte_statut;
