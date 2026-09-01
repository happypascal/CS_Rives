-- =============================================================================
-- Migration 043 — CONTACT OFFICIEL : propriétaire, dirigeant ou mandataire
--
-- Demande de Pascal (2026-09-01) : « pour l'e-mail et le téléphone officiels de
-- communication, soit c'est celui du propriétaire, soit celui du dirigeant, soit
-- du mandataire. Trois boutons radio ; si propriétaire on saisit à la main, si
-- dirigeant ou mandataire on RÉFÉRENCE et le champ n'est pas modifiable. »
--
-- -----------------------------------------------------------------------------
-- UNE SOURCE, PAS UNE COPIE
--
-- La colonne ne stocke QUE le choix — d'où vient l'adresse de convocation — et
-- jamais l'adresse elle-même. Recopier produirait les deux faux habituels :
--   - corriger l'e-mail du mandataire laisserait la convocation partir à
--     l'ancienne adresse, sans que rien ne le signale ;
--   - basculer le bouton écraserait l'adresse propre du propriétaire, qu'on ne
--     retrouverait plus en revenant en arrière.
-- C'est le même principe que le tantième, le budget d'un projet ou le statut
-- d'un projet : DÉRIVÉ à la lecture, jamais stocké.
--
-- Conséquence voulue : `email` et `telephone` restent la propriété du
-- PROPRIÉTAIRE et ne sont écrits que par lui. Les trois blocs cohabitent, un
-- seul est désigné comme officiel.
--
-- `not null default 'proprietaire'` : c'est le cas de la très grande majorité
-- des colotis, et un défaut nul aurait obligé chaque lecture à décider quoi
-- faire de l'absence de choix.
--
-- ⚠ Le `check` énumère les trois valeurs plutôt qu'un type enum : une quatrième
-- source (le notaire, par exemple) se poserait alors par un simple alter, sans
-- migration de type.
--
-- ⚠ Quand la source désignée n'a pas d'adresse, le contact officiel est VIDE —
-- et l'écran doit le dire. Un registre qui affiche l'adresse du propriétaire
-- alors qu'on a désigné le mandataire ferait croire à un envoi possible.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbriqué, aucun
-- deux-points ni barre oblique dans une chaine, et une vérification SIMPLE.
-- =============================================================================

alter table proprietaires
  add column if not exists contact_officiel text not null default 'proprietaire';

alter table proprietaires drop constraint if exists proprietaires_contact_officiel_check;
alter table proprietaires add constraint proprietaires_contact_officiel_check
  check (contact_officiel in ('proprietaire', 'dirigeant', 'mandataire'));

-- Les quatre parcelles dont le seul contact connu est un mandataire sont
-- désignées comme telles. Elles n'ont pas d'adresse de propriétaire, donc leur
-- convocation passe déjà de fait par l'intermédiaire.
update proprietaires
set contact_officiel = 'mandataire'
where email is null and mandataire_email is not null;
