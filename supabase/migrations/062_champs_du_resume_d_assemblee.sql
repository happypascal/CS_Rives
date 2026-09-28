-- =============================================================================
-- Migration 062 — LES CHAMPS DU RÉSUMÉ D ASSEMBLÉE
--
-- Pascal (2026-09-28) : « il y a 1 résumé des décisions dans chaque dossier AG,
-- il a toujours le meme format, donc tu pourrais modifier le format en base pour
-- avoir ces memes champs ».
--
-- Le resume — un PDF par assemblee, de 1988 a 2026 — porte toujours les memes
-- rubriques : president de seance, scrutateur, secretaire, quorum, puis un
-- tableau de resolutions (numero, objet, resultat, pour, contre, abstention).
--
-- =============================================================================
-- 1. DU TEXTE LIBRE À DES CHAMPS
-- =============================================================================
-- ⚠ `resume` (text) ne disparait PAS : il reste la note libre, celle qu on ecrit
-- quand il y a quelque chose a dire que le tableau ne dit pas. Ce que la 062
-- ajoute, ce sont les rubriques REGULIERES, celles qui reviennent a chaque
-- assemblee depuis trente-huit ans — et qu un paragraphe ne permet ni de
-- chercher, ni de comparer d une annee a l autre.
--
-- =============================================================================
-- 2. LES RÉSOLUTIONS EN JSONB, ET SURTOUT PAS DANS `resolutions_ag`
-- =============================================================================
-- ⚠ C est la regle fondatrice du fonds (057), et elle vaut ici plus qu ailleurs :
-- les archives ne creent AUCUNE ligne dans `assemblees_generales` ni dans
-- `resolutions_ag`. Ces tables-la portent un cycle de vie, des budgets, des
-- rattachements a des projets et des engagements du conseil. Y verser trois cent
-- cinquante resolutions votees entre 1988 et 2024 ferait apparaitre des
-- enveloppes qui n existent plus et fausserait les budgets consolides.
--
-- Un jsonb dit ce qu il est : la TRANSCRIPTION d un tableau, pas un objet que
-- l application gere. On ne s y rattache pas, on le lit.
--
-- =============================================================================
-- 3. LES VOIX SONT DES NOMBRES, QUAND ELLES SONT CHIFFRÉES
-- =============================================================================
-- ⚠ `pour`, `contre`, `abstention` sont nuls quand le proces-verbal ne chiffre
-- pas le vote — ce qui arrive souvent avant 2003, et encore en 2026 sur une
-- resolution. Un zero dirait « personne n a vote pour », un null dit « le PV ne
-- le dit pas ». La difference compte : la premiere est une defaite, la seconde
-- une lacune.
--
-- ⚠ Et l UNITE change avec les decennies : lots en 1988, voix sur 5 100 de 2003
-- a 2024, metres carres sur 104 646 depuis 2026. `unite_vote` la porte en toutes
-- lettres — additionner des voix de 2012 et des m2 de 2026 n aurait aucun sens,
-- et une colonne numerique sans unite y inviterait.
--
-- ⚠ RAPPEL DE FORME (editeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbrique, aucun
-- deux-points ni barre oblique dans une chaine, et une verification SIMPLE.
-- =============================================================================

alter table pv_archives
  add column if not exists president_seance      text,
  add column if not exists scrutateur            text,
  add column if not exists presents_representes  text,
  add column if not exists unite_vote            text,
  add column if not exists resolutions           jsonb,
  add column if not exists resume_etabli_le      date;

comment on column pv_archives.presents_representes is
  'Le quorum en toutes lettres, tel que le PV l exprime. Sa forme change avec les decennies (41 lots sur 49 ; 33 membres, 3 400 voix sur 5 100 ; 44 membres, 92 146 m2 sur 104 646). Le structurer aurait impose d inventer une unite commune.';

comment on column pv_archives.unite_vote is
  'Unite dans laquelle les voix sont comptees pour CETTE assemblee. Lots avant 2003, voix sur 5 100 ensuite, metres carres depuis 2026. Sans elle, les nombres de resolutions ne veulent rien dire.';

comment on column pv_archives.resolutions is
  'Transcription du tableau du resume : [{numero, objet, resultat, pour, contre, abstention}]. ⚠ JAMAIS dans resolutions_ag : les archives ne creent aucune ligne de gestion. Voix nulles quand le PV ne chiffre pas le vote — un zero serait une defaite, un null est une lacune.';

comment on column pv_archives.resume_etabli_le is
  'Date a laquelle le resume a ete redige, et non date de l assemblee. Un resume relu et corrige plus tard doit pouvoir le dire.';

-- ---------------------------------------------------------- vérification
-- Les colonnes existent et les 25 archives sont intactes.
select
  (select count(*) from pv_archives)                                as archives,
  (select count(*) from pv_archives where resolutions is not null)  as avec_resolutions,
  (select count(*) from information_schema.columns
     where table_name = 'pv_archives'
       and column_name in ('president_seance','scrutateur','presents_representes',
                           'unite_vote','resolutions','resume_etabli_le'))  as colonnes_posees;
