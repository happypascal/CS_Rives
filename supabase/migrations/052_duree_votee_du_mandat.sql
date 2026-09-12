-- =============================================================================
-- Migration 052 — DURÉE VOTÉE du mandat (1 an, 2 ans…), et non une date de fin
--
-- Correction de Pascal (2026-09-12) : « plutôt qu'une date pour la fin de
-- mandat, on vote pour 1 an ou 2 ans en fait. »
--
-- CE QUE LA 051 AVAIT MAL MODÉLISÉ. Elle ne connaissait que `date_fin`, saisie à
-- la main. Or l'assemblée ne vote PAS une date : elle élit pour une DURÉE. Faire
-- calculer « 15/09/2026 + 2 ans » par le président avant de taper le résultat,
-- c'est lui demander de convertir la décision de l'AG en une donnée qui n'est
-- plus celle qu'elle a votée — et c'est perdre l'information réellement
-- délibérée, qui est la durée.
--
-- ⚠ DEUX NOTIONS DISTINCTES, QU'IL NE FAUT PAS FUSIONNER. C'est tout l'objet de
-- cette migration, et le piège à ne pas rouvrir :
--
--   `duree_annees` — ce que l'AG A VOTÉ. Une intention, connue le jour de
--                    l'élection. De là se DÉRIVE une échéance théorique
--                    (`date_debut` + N ans), jamais stockée — même principe que
--                    le tantième ou le budget d'un projet.
--
--   `date_fin`     — ce qui S'EST RÉELLEMENT PASSÉ : le jour où la période a
--                    pris fin. Réélection, démission, non-renouvellement. Nulle
--                    tant que le mandat court.
--
-- Les confondre serait faux dans les deux sens : un mandat voté pour deux ans
-- peut s'interrompre au bout de six mois par une démission, et un membre élu
-- pour un an reste en fonction au-delà du terme jusqu'à l'AG qui le renouvelle
-- — cas ORDINAIRE, pas une anomalie.
--
-- ⚠ D'OÙ UNE RÈGLE QUI COMPTE POUR LE QUORUM : l'échéance dérivée ne clôt RIEN
-- toute seule. Elle ne touche ni `date_fin`, ni `membres_cs.date_fin`, ni donc
-- `activeMembersAt`. Si l'échéance fermait automatiquement le mandat, un membre
-- qui siège encore sortirait du dénominateur du quorum au milieu d'un vote, en
-- silence, et une délibération deviendrait irrégulière sans que personne n'ait
-- rien fait. L'écran SIGNALE un mandat échu ; il ne le ferme pas. Même esprit
-- que « rien ne s'adopte tout seul » pour les décisions.
--
-- ⚠ NULLABLE, et sans valeur par défaut. La durée de bien des mandats anciens
-- n'est pas connue de nous ; `not null default 1` ferait affirmer au registre
-- une durée d'un an que personne n'a votée. Nul veut dire « non renseignée »,
-- pas « illimitée ».
--
-- `> 0` seulement, aucun plafond : les statuts en cours de révision pourraient
-- retenir trois ans, et une contrainte inventée ici obligerait à une migration
-- pour un chiffre que nous n'avons pas à arbitrer.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbriqué, aucun
-- deux-points ni barre oblique dans une chaine, et une vérification SIMPLE.
-- =============================================================================

alter table mandats_cs
  add column if not exists duree_annees integer;

alter table mandats_cs
  drop constraint if exists mandats_cs_duree_positive;

alter table mandats_cs
  add constraint mandats_cs_duree_positive
  check (duree_annees is null or duree_annees > 0);

comment on column mandats_cs.duree_annees is
  'Duree VOTEE par l AG, en annees. L echeance theorique en est derivee (date_debut + N ans) et n est jamais stockee. Ne ferme jamais le mandat : date_fin seule constate la fin reelle.';

-- ---------------------------------------------------------- vérification
-- La colonne existe et n'est encore renseignée nulle part : c'est normal, la
-- durée de chaque mandat déjà inscrit est à saisir depuis l'écran.
select
  (select count(*) from mandats_cs)                                as mandats,
  (select count(*) from mandats_cs where duree_annees is not null) as avec_duree;
