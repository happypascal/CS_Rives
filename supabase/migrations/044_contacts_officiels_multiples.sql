-- =============================================================================
-- Migration 044 — LES DESTINATAIRES OFFICIELS SONT PLUSIEURS
--
-- Correction de Pascal (2026-09-01) : « s'il y a un e-mail pour le mandataire ET
-- pour le propriétaire, il faut envoyer aux deux. Et il y a le cas des SCI ou des
-- donations avec usufruitier : mandataire + propriétaire, ou deux propriétaires,
-- ou dirigeant + propriétaire (usufruitier). Il faut des cases à cocher. »
--
-- La 043 posait un choix UNIQUE — un bouton radio. C'était un contresens sur la
-- réalité d'une convocation : on n'écrit pas à une personne, on convoque tous
-- ceux qui doivent l'être. Une indivision a deux indivisaires à prévenir ; une
-- donation démembrée a l'usufruitier ET le nu-propriétaire ; une SCI dont le
-- gérant est au loin se convoque chez lui ET chez son mandataire sur place.
-- Ne retenir qu'une adresse, c'était accepter de ne pas convoquer quelqu'un.
--
-- -----------------------------------------------------------------------------
-- POURQUOI UN TABLEAU PLUTÔT QUE QUATRE BOOLÉENS
--
-- L'opération naturelle est « donne-moi tous les destinataires de ce lot » :
-- c'est une liste, et elle se lit, se parcourt et s'exporte comme telle. Quatre
-- colonnes booléennes obligeraient chaque appelant à les réunir à la main, et
-- une cinquième destination (le notaire, l'usufruitier nommément) coûterait une
-- colonne de plus à chaque fois.
--
-- ⚠ Le changement de type PRÉSERVE les choix déjà faits : `array[contact_officiel]`
-- transforme 'mandataire' en {mandataire}. Les quatre parcelles que Pascal avait
-- réglées à la main gardent leur réglage.
--
-- ⚠ La colonne est RENOMMÉE au pluriel. Un nom singulier pour un ensemble est
-- exactement la dérive corrigée par la 042 entre « gérant » et « dirigeant » :
-- le nom doit dire ce que la colonne contient.
--
-- ⚠ Au moins un destinataire : un ensemble vide voudrait dire « ne convoquer
-- personne », ce qu'aucun registre ne doit pouvoir exprimer par distraction. Un
-- lot injoignable se reconnaît à ce que ses destinataires n'ont pas d'adresse,
-- pas à ce qu'il n'en désigne aucun.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbriqué, aucun
-- deux-points ni barre oblique dans une chaine, et une vérification SIMPLE.
-- =============================================================================

alter table proprietaires drop constraint if exists proprietaires_contact_officiel_check;
alter table proprietaires alter column contact_officiel drop default;

alter table proprietaires
  alter column contact_officiel type text[] using array[contact_officiel];

alter table proprietaires rename column contact_officiel to contacts_officiels;

alter table proprietaires
  alter column contacts_officiels set default array['proprietaire'];

alter table proprietaires drop constraint if exists proprietaires_contacts_officiels_check;
alter table proprietaires add constraint proprietaires_contacts_officiels_check
  check (
    array_length(contacts_officiels, 1) >= 1
    and contacts_officiels <@ array['proprietaire', 'proprietaire_2', 'dirigeant', 'mandataire']
  );

-- Le second propriétaire est ajouté d'office là où il existe : s'il est inscrit
-- au registre, c'est qu'il est copropriétaire, et un copropriétaire se convoque.
-- Ne pas le faire aurait laissé dix-sept personnes hors des convocations sans
-- que rien ne le signale.
update proprietaires
set contacts_officiels = contacts_officiels || array['proprietaire_2']
where nom_2 is not null
  and not (contacts_officiels @> array['proprietaire_2']);
