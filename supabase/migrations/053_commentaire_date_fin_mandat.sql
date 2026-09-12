-- =============================================================================
-- Migration 053 — COMMENTAIRES SEULS : la date de fin porte désormais le terme
--
-- ⚠ MIGRATION COSMÉTIQUE. Elle ne crée, ne modifie et ne supprime AUCUNE donnée,
-- aucune colonne, aucune contrainte, aucune policy. Elle ne fait que corriger
-- deux commentaires de la base devenus faux. Rien ne casse si elle n'est pas
-- appliquée — mais un commentaire faux dans le schéma d'un registre légal finit
-- toujours par égarer quelqu'un, et ce quelqu'un sera probablement le prochain
-- à reprendre le projet.
--
-- CE QUI A CHANGÉ (demande de Pascal, 2026-09-12) : « la date de fin de mandat
-- doit être calculée automatiquement quand on choisit 1, 2 ou 3 ans ».
--
-- La 052 avait séparé strictement la DURÉE VOTÉE (l'intention de l'AG) de la
-- DATE DE FIN (le fait constaté), en laissant l'échéance dérivée à l'affichage
-- seul. En usage, cette pureté coûtait une addition mentale au président —
-- « 15/09/2026 plus deux ans » — à refaire pour chaque membre, dans un registre
-- où une erreur d'un jour est une erreur de fond. L'écran calcule donc la date
-- et la pose dans le champ.
--
-- ⚠ CE QUE `date_fin` VEUT DIRE MAINTENANT : le TERME DU MANDAT — l'échéance
-- votée par défaut, corrigée à la main si la période s'est close avant (démission,
-- départ, réélection anticipée). Elle reste donc bien le fait constaté ; elle est
-- simplement PRÉ-REMPLIE par le calcul au lieu d'être tapée.
--
-- ⚠ CE QUI N'A PAS CHANGÉ, et qui est le point important : un terme dépassé ne
-- fait TOUJOURS sortir personne du conseil. Il ne touche ni `membres_cs.actif`,
-- ni `membres_cs.date_fin`, donc pas `activeMembersAt` ni le dénominateur du
-- quorum. Un membre élu pour un an siège jusqu'à l'AG qui le renouvelle : son
-- mandat s'affiche « échu », il continue de voter. L'application SIGNALE, elle
-- ne révoque pas.
--
-- ⚠ CONSÉQUENCE SUR LE CÔTÉ JS, notée ici parce qu'elle n'est pas devinable :
-- « mandat en cours » n'est plus « celui sans date de fin » (ils en ont tous une
-- désormais) mais LE DERNIER COMMENCÉ. L'index partiel
-- `mandats_cs_en_cours_par_membre` n'a donc plus d'invariant à porter — il est
-- conservé, sans dommage, mais ce n'est plus lui qui garantit l'unicité du
-- mandat courant : un maximum n'ayant qu'une valeur, c'est structurel.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbriqué, aucun
-- deux-points ni barre oblique dans une chaine, et une vérification SIMPLE.
-- =============================================================================

comment on column mandats_cs.duree_annees is
  'Duree VOTEE par l AG, en annees. Sert a calculer le terme pose dans date_fin a la saisie. Un terme depasse ne fait sortir personne du conseil ni du quorum.';

comment on column mandats_cs.date_fin is
  'TERME du mandat : l echeance votee par defaut (date_debut plus duree_annees), corrigee a la main si la periode s est close avant. Cote applicatif, le mandat EN COURS est le dernier commence, pas celui sans date de fin.';

-- ---------------------------------------------------------- vérification
-- Rien n'a bougé : mêmes lignes qu'avant.
select
  (select count(*) from mandats_cs)                                as mandats,
  (select count(*) from mandats_cs where duree_annees is not null) as avec_duree;
