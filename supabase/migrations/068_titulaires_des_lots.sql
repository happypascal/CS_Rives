-- =====================================================================
-- Migration 068 — TOUS LES TITULAIRES DE CHAQUE LOT
--
-- Brief du 22 octobre 2026, arbitrages de Pascal du meme jour.
--
-- Le registre ne sait decrire que DEUX personnes par lot (`nom` et
-- `nom_2`, `email` et `email_2`), plus un ou deux dirigeants, un
-- mandataire, et UNE seule adresse postale. Il ne peut donc pas
-- representer :
--   - une indivision de trois personnes ou plus (donation a
--     plusieurs enfants, succession) ;
--   - un demembrement (usufruitier et nus-proprietaires) ;
--   - une adresse postale propre a chaque personne ;
--   - le representant designe d une indivision, et la piece qui
--     le designe.
--
-- La 044 avait ouvert la voie en reconnaissant que les destinataires
-- sont PLUSIEURS. La 068 generalise : une LIGNE par personne.
--
-- =====================================================================
-- 0. RAPPEL DE FORME (editeur SQL de Supabase)
-- =====================================================================
-- Aucune chaine vide, aucun argument de formatage de `raise`, aucun
-- guillemet dollar imbrique, aucun deux-points ni barre oblique dans
-- une chaine, aucune apostrophe dans un commentaire, et une
-- verification SIMPLE.
--
-- ⚠ ET AUCUNE LIGNE DE PLUS DE 72 COLONNES — regle nouvelle, apprise
-- le 22 octobre 2026. Ce fichier se colle a la main dans un editeur
-- web, et il a ete copie une fois depuis un affichage de terminal qui
-- REPLIE a 80 colonnes. Le retour a la ligne est tombe au milieu d un
-- commentaire, et la fin du commentaire est redevenue du code
-- (ERROR 42601, syntax error). Trois formes sont fatales a un repli,
-- et ce fichier les evite toutes les trois :
--   - un commentaire trop long ;
--   - un separateur de tirets trop long, dont la seconde moitie
--     n a plus ses deux tirets ;
--   - un commentaire place EN BOUT DE LIGNE DE CODE.
-- Le code replie, lui, reste valide : SQL ignore les blancs. Une
-- chaine repliee reste valide aussi, elle garde juste un retour a la
-- ligne — c est pourquoi les `comment on` plus bas restent longs.
--
-- =====================================================================
-- 1. CE QUE LES STATUTS DU 15 SEPTEMBRE 2026 IMPOSENT
-- =====================================================================
-- ⚠ Les articles ont ete LUS dans le fichier des statuts, pas resumes
-- de memoire. Leur texte VERBATIM est reproduit en tete de
-- `scripts/importer_titulaires_2026-10-22.mjs` — ici, pas de citation
-- entre guillemets : la convention de ces migrations proscrit
-- l apostrophe, et une citation legale amputee de ses apostrophes ne
-- serait plus une citation.
--
-- Article 1 — est membre de l association TOUT proprietaire, pour
--   quelque cause et a quelque titre que ce soit. ⚠ C est le
--   fondement du role `co_proprietaire` : un conjoint coproprietaire
--   est membre de plein droit, meme quand la detention a deux n est
--   pas une indivision (040).
--
-- Article 6 — trois cas particuliers, et ce sont EXACTEMENT les roles
--   de cette table : les indivisaires ne peuvent se faire representer
--   que par l un d eux (`est_representant_designe`) ; en cas de
--   nue-propriete et d usufruit, l usufruitier prend SEUL la qualite
--   de membre et doit informer le nu-proprietaire (`usufruitier` et
--   `nu_proprietaire`) ; pour une personne morale, le representant
--   legal assure la representation, ou toute autre personne
--   justifiant de ses pouvoirs (`representant_legal`).
--
-- Article 8 et article 13 — les convocations comme les notifications
--   sont adressees en privilegiant les moyens electroniques, SAUF
--   demande expresse contraire d un coloti. D ou
--   `refus_electronique`, UN seul drapeau pour les deux envois :
--   c est une demande de la personne, pas un reglage par courrier.
--
-- Article 9 — chaque coloti dispose d un nombre de voix correspondant
--   a la SUPERFICIE de son lot, et le conseil syndical etablit et
--   tient a jour la liste des proprietaires avec le nombre de voix
--   dont ils disposent. ⚠ Cette table, avec `lots` et
--   `proprietaires`, EST cette obligation statutaire.
--
-- Article 13 — copie du proces-verbal sous pli simple a ceux qui ont
--   participe et vote pour ou se sont abstenus ; sous pli RECOMMANDE
--   avec avis de reception a ceux qui n ont pas participe ou ont vote
--   contre. Prescription des recours : un an.
--
-- Article 21 — solidarite et indivisibilite entre tous les
--   proprietaires d un immeuble DANS LE CADRE D UNE INDIVISION.
--   ⚠ Le texte ne nomme que l indivision : ce n est donc PAS lui qui
--   fonde `co_proprietaire`, c est l article 1. Le dire faux ici
--   reviendrait a preter aux statuts une regle qu ils ne portent pas.
--
-- Article 22 — la mutation est declaree quinze jours au plus apres la
--   signature de l acte de vente ou de donation EN PLEINE PROPRIETE,
--   faute de quoi le vendeur reste personnellement engage. ⚠ Ni la
--   donation avec reserve d usufruit, ni la succession n y sont
--   nommees : l assistant de mutation ne devra PAS afficher un delai
--   statutaire de quinze jours sur ces deux scenarios. Un delai
--   invente est une faute dans un registre legal.
--
-- Article 28 — les proprietaires font election de domicile EN LEUR
--   DEMEURE RESPECTIVE. ⚠ C est ce qui rend une adresse heritee
--   insuffisante, et non un simple confort de saisie : l adresse du
--   conjoint n est pas la demeure respective de l autre. D ou
--   `adresse_a_verifier` (section 5).
--
-- =====================================================================
-- 2. CE QUE CETTE TABLE NE FAIT PAS, ET NE DOIT JAMAIS FAIRE
-- =====================================================================
-- ⚠ ELLE NE PESE AUCUNE VOIX. Les voix suivent `lots.superficie`
-- (article 9), et les metres carres de chaque assemblee sont SAISIS
-- puis FIGES sur elle (`assemblees_generales.m2_total`, 054).
-- `est_membre_votant` dit QUI porte la voix du lot, jamais COMBIEN
-- elle pese. Brancher un calcul de voix sur cette table changerait une
-- regle de vote par effet de bord — meme partage que `mandats_cs` qui
-- RACONTE et `membres_cs` qui OPERE (051).
--
-- ⚠ ELLE NE DIT PAS LE MOYEN DE NOTIFICATION. L article 13 fait
-- dependre le pli simple ou le recommande de la facon dont la personne
-- a vote A CETTE assemblee — une donnee que l application ne detient
-- pas (elle n enregistre ni la presence ni le vote nominatif en AG).
-- `destinataire_notification_pv` dit QUI doit etre notifie. Il ne dit
-- pas comment, et un ecran ne doit pas le laisser croire.
--
-- ⚠ LE DELAI D UN AN N EST PAS CONDITIONNE PAR PERSONNE DANS LES
-- STATUTS. Le brief ecrit que chaque indivisaire doit etre notifie
-- pour que le delai d un an coure contre lui : c est une
-- INTERPRETATION, prudente et vraisemblable, mais l article 13 fixe
-- une prescription d un an sans la rattacher a la notification de
-- chacun. On note, on ne fait pas dire aux statuts.
--
-- ⚠ ELLE NE MODELISE PAS LES POUVOIRS D ASSEMBLEE. L article 6
-- connait un MANDATAIRE qui doit lui-meme etre membre de
-- l association (sauf conjoint, ascendant ou descendant), dont le
-- mandat est ecrit, et qui ne peut en detenir plus de quatre. CE N EST
-- PAS le `mandataire` de la 037, qui est l intermediaire permanent a
-- qui l on parle quand on n atteint pas le proprietaire — cas des
-- colotis etrangers. Les confondre ferait croire qu un mandataire de
-- contact peut voter. D ou la contrainte qui lui interdit
-- `est_membre_votant`, et l absence de toute modelisation du pouvoir,
-- qui est propre a UNE assemblee et vit dans son proces-verbal.
--
-- =====================================================================
-- 3. LE TITULAIRE SE RATTACHE A LA PERIODE, PAS AU LOT
-- =====================================================================
-- `proprietaire_id` et non `lot_id`. Une personne est titulaire parce
-- qu elle a acquis, herite ou recu : son lien est celui de la PERIODE
-- de propriete, exactement le raisonnement de la 059 pour le titre de
-- propriete. Pose sur `lots`, la ligne survivrait a une mutation et le
-- registre attribuerait au nouvel arrivant les personnes du precedent.
--
-- `on delete cascade` : l historique part avec la periode, qui part
-- elle-meme avec le lot (035).
--
-- ⚠ L unicite se compte donc PAR PERIODE et non par lot — ce qui est
-- la meme chose pour la periode en cours, puisque
-- `proprietaires_actuel_par_lot` (035) garantit un seul proprietaire
-- actuel par lot. Mais une periode passee garde ainsi son propre
-- membre votant, et le registre peut dire qui votait pour ce lot
-- en 2019.
--
-- =====================================================================
-- 4. LES ROLES, ET POURQUOI `co_proprietaire` A ETE AJOUTE AU BRIEF
-- =====================================================================
--   plein_proprietaire  seul proprietaire ; ou, pour une societe, la
--                       ligne qui porte la raison sociale et
--                       l adresse du siege
--   indivisaire         membre d une indivision, qualification CONNUE
--   co_proprietaire     detenteur avec un autre, NON qualifie
--   usufruitier         seul membre de l association (article 6)
--   nu_proprietaire     informe par l usufruitier, ne vote pas
--   representant_legal  dirigeant d une personne morale
--   mandataire          intermediaire de contact (037), jamais un
--                       pouvoir d assemblee
--
-- ⚠ `co_proprietaire` N EST PAS DANS LE BRIEF, et son absence etait un
-- piege. Mesure faite sur l export du 14 octobre : 19 periodes portent
-- deux noms, et SEULES 4 ont `est_indivision`. Les 15 autres sont les
-- conjoints coproprietaires inscrits le 28 aout, sur la regle « M. OU
-- MME chez Foncia veut dire que les deux sont proprietaires ». Or la
-- 040 dit que deux proprietaires N EST PAS une indivision : `nom_2`
-- constate le FAIT, et `est_indivision` porte la QUALIFICATION, cochee
-- seulement quand on la connait. Reprendre ces 15 lignes en
-- `indivisaire` aurait fait qualifier par l application quinze
-- situations que seul le notaire qualifie.
--
-- ⚠ ET IL SE NOTIFIE COMME UN INDIVISAIRE (arbitrage Pascal,
-- 22 octobre) : un conjoint en communaute comme en separation de biens
-- est proprietaire du lot, donc membre (article 1), donc destinataire
-- de la notification du proces-verbal. `destinataire_notification_pv`
-- est vrai par defaut pour lui comme pour l indivisaire et le
-- nu-proprietaire.
--
-- =====================================================================
-- 5. `adresse_a_verifier` — LE SEUL AJOUT DE COLONNE AU BRIEF
-- =====================================================================
-- Le brief demande que l adresse du second indivisaire, heritee de la
-- fiche, soit « marquee a verifier » sans dire OU. Dans
-- `observations`, la marque est du texte libre : un controle qui la
-- cherche par motifs trouve des candidates, jamais un fait — c est la
-- lecon des regles de gestion du 6 octobre.
--
-- Une adresse heritee n est pas une petite imperfection. Mesure
-- faite : AUCUN des 19 seconds noms n a d adresse propre, et les 14
-- societes a deux dirigeants n ont qu une `adresse_dirigeant` pour les
-- deux. Devant l article 28 (election de domicile en leur demeure
-- respective) et l article 13 (recommande avec avis de reception),
-- c est precisement l adresse de ce genre qui empeche une notification
-- de valoir.
--
-- ⚠ Et c est le trou que les quatre controles du brief ne voyaient
-- pas : la personne qui herite d une adresse n est ni « sans e-mail ET
-- sans adresse », ni « en refus sans adresse » ; aucun des quatre ne
-- se declenche sur elle. D ou le cinquieme controle, approuve le
-- 22 octobre, et la colonne qui le rend calculable.
--
-- =====================================================================
-- 6. LES CONTRAINTES, ET CELLE QUI A ETE ECARTEE
-- =====================================================================
-- Au plus un membre votant par periode, au plus un representant
-- designe par periode : deux index partiels, exactement le role de
-- `proprietaires_actuel_par_lot` (035) et de
-- `mandats_cs_en_cours_par_membre` (051).
--
-- ⚠ « AU MOINS UN » NE PEUT PAS ETRE UNE CONTRAINTE. Un check ne
-- compte pas ses lignes soeurs, et un trigger d etat bloquerait
-- l instant legitime ou une mutation a clos le votant sortant sans
-- avoir cree l entrant. « Exactement un membre votant par lot » reste
-- donc un AVERTISSEMENT, jamais un refus : meme doctrine que
-- `divergences()` dans `mandatLogic.js`, on signale et on ne corrige
-- pas.
--
-- ⚠ L USUFRUITIER EST LE MEMBRE VOTANT, et c est une contrainte dure
-- parce que l article 6 n admet aucune exception (verifie dans le
-- texte, section 1). Elle impose un ORDRE : clore ou devoter le votant
-- precedent, PUIS creer l usufruitier — sinon l index partiel refuse.
-- C est l ordre impose de la reelection (051) et celui de
-- `enregistrerMutation` (035). Non atomique et assume ; un echec a
-- mi-chemin laisse le lot sans votant, ce qui est VISIBLE a l ecran,
-- la ou deux votants ne se verraient pas.
--
-- ⚠ ECARTEE : un check interdisant `refus_electronique` a qui n est
-- destinataire de rien. Il bloquerait une modification sans rapport —
-- decocher un envoi ferait echouer la sauvegarde d une ligne par
-- ailleurs juste — alors qu un drapeau inerte n affirme rien de faux.
-- Les contraintes de ce registre n interdisent que ce qui est
-- TOUJOURS faux.
--
-- =====================================================================
-- 7. RIEN N EST SUPPRIME, LA BASCULE SE FAIT PERIODE PAR PERIODE
-- =====================================================================
-- Les colonnes de 038, 040, 041, 042, 043 et 044 restent. Les lecteurs
-- (`destinatairesDuLot`, a venir) prendront les titulaires DES QUE la
-- periode en a, et les anciennes colonnes sinon. Un drapeau global
-- obligerait a tout migrer d un coup ; une bascule par periode rend la
-- reprise progressive et reversible.
--
-- ⚠ Et l ecran devra rendre les anciennes colonnes NON MODIFIABLES sur
-- une periode qui a des titulaires : deux formulaires qui ecrivent la
-- meme adresse divergent des la premiere correction, sans que rien ne
-- le signale.
-- =====================================================================

create table if not exists titulaires (
  id                  uuid primary key default gen_random_uuid(),

  -- La PERIODE de propriete, pas le lot (section 3).
  proprietaire_id     uuid not null
                      references proprietaires(id) on delete cascade,

  -- Les sept roles de la section 4. Contrainte nommee plus bas : elle
  -- COMMANDE les droits de vote et de notification, contrairement a
  -- une categorie libre.
  role                text not null,

  -- Pour un indivisaire, un nu-proprietaire ou un plein proprietaire
  -- qui serait une societe. ⚠ Distinct de
  -- `proprietaires.est_societe`, qui qualifie la PERIODE : aucune
  -- synchronisation entre les deux, et c est voulu.
  est_personne_morale boolean not null default false,

  -- M., Mme, ou rien pour une societe.
  civilite            text,
  nom                 text not null,
  prenom              text,
  -- Gerant, president, associe (article 6).
  fonction            text,
  -- Telle qu elle se lit a l acte, en toutes lettres. Une fraction
  -- structuree obligerait a choisir un denominateur commun que les
  -- actes ne donnent pas.
  quote_part          text,

  -- Article 28 : election de domicile en leur demeure RESPECTIVE. Une
  -- adresse par personne, sur plusieurs lignes.
  adresse_postale     text,
  pays                text,
  -- ⚠ L adresse ne vient pas de la personne mais de la fiche dont
  -- elle a ete reprise (section 5). Elle ne vaut pas election de
  -- domicile.
  adresse_a_verifier  boolean not null default false,

  email               text,
  telephone           text,
  -- fr ou en, sans contrainte de valeur :
  -- `communication_destinataires.langue` n en a pas, et un de est
  -- plausible chez des colotis suisses.
  langue              text,
  -- Articles 8 et 13 : demande expresse contraire au moyen
  -- electronique.
  refus_electronique  boolean not null default false,

  -- Qui porte la voix du lot. ⚠ Ne pese aucune voix (section 2).
  est_membre_votant        boolean not null default false,
  -- Article 6 : celui des indivisaires qui represente les autres.
  est_representant_designe boolean not null default false,

  -- La designation ecrite, signee des indivisaires. Meme convention
  -- que partout (012) : la ligne ne garde que le chemin, le nom, le
  -- type et la taille, le fichier vit dans le bucket prive.
  -- ⚠ Le chemin porte l id du PROPRIETAIRE et non du titulaire : la
  -- periode existe au moment de l envoi, la ligne du titulaire pas
  -- encore — meme raison qu en 046 et 050. ⚠ Et il faut une policy de
  -- Storage, voir plus bas : ce sont les premieres pieces jointes a
  -- donnees personnelles de l application.
  designation_documents    jsonb not null default '[]'::jsonb,

  -- Qui recoit quoi. `destinataire_convocations` reprend ce que
  -- `contacts_officiels` designait (044) ;
  -- `destinataire_notification_pv` est vrai par defaut, l article 13
  -- ne laissant pas le choix de notifier ou non un proprietaire.
  destinataire_convocations    boolean not null default true,
  destinataire_notification_pv boolean not null default true,

  -- La periode du titulaire, DANS celle de la propriete. Nulle =
  -- inconnue, comme `proprietaires.date_acquisition`. `date_fin`
  -- nulle = titulaire actuel.
  -- ⚠ Aucune contrainte croisee avec `proprietaires` : il faudrait un
  -- trigger, et un titulaire reste ouvert sur une periode cedee est
  -- signale par un avertissement, pas refuse.
  date_debut          date,
  date_fin            date,

  observations        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ------------------------------------------------------- contraintes
alter table titulaires
  drop constraint if exists titulaires_role_check;
alter table titulaires
  add constraint titulaires_role_check
  check (role in ('plein_proprietaire', 'indivisaire',
                  'co_proprietaire', 'usufruitier', 'nu_proprietaire',
                  'representant_legal', 'mandataire'));

-- Une periode ne se termine pas avant d avoir commence.
alter table titulaires
  drop constraint if exists titulaires_periode_coherente;
alter table titulaires
  add constraint titulaires_periode_coherente
  check (date_fin is null
         or date_debut is null
         or date_fin >= date_debut);

-- Article 6 : le nu-proprietaire ne vote pas, et celui qui agit POUR
-- un autre ne vote jamais en son nom propre.
alter table titulaires
  drop constraint if exists titulaires_votant_interdit;
alter table titulaires
  add constraint titulaires_votant_interdit
  check (not (est_membre_votant
              and role in ('nu_proprietaire',
                           'representant_legal',
                           'mandataire')));

-- Article 6 : en cas de nue-propriete et d usufruit, l usufruitier
-- prend SEUL la qualite de membre. Un usufruitier en cours qui ne
-- serait pas le membre votant serait un etat que les statuts ne
-- connaissent pas. ⚠ ORDRE IMPOSE, section 6.
alter table titulaires
  drop constraint if exists titulaires_usufruitier_votant;
alter table titulaires
  add constraint titulaires_usufruitier_votant
  check (role <> 'usufruitier'
         or date_fin is not null
         or est_membre_votant);

-- Article 6 : les indivisaires ne peuvent se faire representer que
-- par L UN D EUX. Le representant designe est donc l un des
-- detenteurs, jamais un dirigeant (qui represente de plein droit) ni
-- un mandataire de contact.
alter table titulaires
  drop constraint if exists titulaires_representant_est_detenteur;
alter table titulaires
  add constraint titulaires_representant_est_detenteur
  check (not est_representant_designe
         or role in ('indivisaire', 'co_proprietaire'));

-- ------------------------------------------------------------- index
-- AU PLUS un membre votant, AU PLUS un representant designe, par
-- periode et parmi les titulaires en cours. Index partiels : les
-- lignes closes n y participent pas, donc autant de titulaires passes
-- qu on veut.
create unique index if not exists titulaires_votant_par_propriete
  on titulaires (proprietaire_id)
  where est_membre_votant and date_fin is null;

create unique index if not exists titulaires_representant_par_propriete
  on titulaires (proprietaire_id)
  where est_representant_designe and date_fin is null;

create index if not exists titulaires_propriete_idx
  on titulaires (proprietaire_id, date_debut);

-- Le rapprochement des envois se fait sur l adresse (056).
create index if not exists titulaires_email_idx
  on titulaires (email) where email is not null;

-- ---------------------------------------------------------- triggers
-- E-mail canonique, comme `membres_cs` (018) et `proprietaires`
-- (035) : la casse a deja casse un appariement d identite une fois en
-- production.
create or replace function titulaires_normalise_email()
returns trigger
language plpgsql
set search_path = public
as $normalise_email_tit$
begin
  if new.email is not null then
    new.email := lower(btrim(new.email));
  end if;
  return new;
end $normalise_email_tit$;

drop trigger if exists trg_titulaires_normalise_email on titulaires;
create trigger trg_titulaires_normalise_email
  before insert or update of email
  on titulaires
  for each row execute function titulaires_normalise_email();

create or replace function titulaires_touch()
returns trigger
language plpgsql
as $touch_tit$
begin
  new.updated_at := now();
  return new;
end $touch_tit$;

drop trigger if exists trg_titulaires_touch on titulaires;
create trigger trg_titulaires_touch
  before update on titulaires
  for each row execute function titulaires_touch();

-- --------------------------------------------------------------- RLS
-- ⚠ PRESIDENT ET SECRETAIRE UNIQUEMENT, lecture COMME ecriture — le
-- regime exact de `lots` et `proprietaires` (035), et cette table
-- n est donc PAS dans la boucle `read_auth` du schema. Un tresorier,
-- un membre ordinaire ne voient rien.
--
-- ⚠ LE BRIEF DEMANDAIT LES DEUX A LA FOIS : « memes regles RLS que
-- `proprietaires` » ET « lecture par le conseil », qui sont opposees,
-- puisque tout le point de la 035 est que le conseil ne lit PAS ce
-- registre. Tranche par la nature de la donnee, et confirme par
-- Pascal le 22 octobre : cette table porte PLUS de donnees
-- personnelles que `proprietaires` — une adresse postale par
-- indivisaire, par nu-proprietaire, par dirigeant.
alter table titulaires enable row level security;

drop policy if exists "titulaires_bureau" on titulaires;
create policy "titulaires_bureau" on titulaires
  for all to authenticated
  using (is_admin() or is_secretaire())
  with check (is_admin() or is_secretaire());

-- ----------------------------------------------------------- Storage
-- ⚠⚠ IL FAUT UNE POLICY ICI, et c est le point le plus facile a
-- manquer de toute cette migration. Verifie, pas suppose :
-- `documents_read_auth` (012) est un select ouvert a tout le bucket —
-- TOUT MEMBRE CONNECTE LIT TOUT — et la seule restrictive existante,
-- `documents_brouillon_prive` (026), ne teste que le premier segment
-- decisions. Une designation d indivision deposee sous le prefixe
-- proprietaires serait donc lisible par le tresorier et par tout
-- membre ordinaire, PENDANT QUE la ligne qui la cite leur est fermee
-- par la 035. La RLS de la table serait contournee par la porte de
-- derriere.
--
-- RESTRICTIVE et ADDITIVE, comme sa soeur : on ne reecrit pas la
-- policy de lecture, pour qu un echec de deploiement ne puisse jamais
-- laisser le bucket sans lecture du tout. Le premier segment est
-- teste d abord, donc aucun autre prefixe n est concerne.
drop policy if exists "documents_proprietaires_bureau_read"
  on storage.objects;
create policy "documents_proprietaires_bureau_read" on storage.objects
  as restrictive for select to authenticated
  using (
    (storage.foldername(name))[1] is distinct from 'proprietaires'
    or public.is_admin()
    or public.is_secretaire()
  );

-- Et dans l autre sens : `documents_insert_membre` ouvre le depot a
-- tout membre actif, sur n importe quel prefixe. Un fichier depose
-- sous proprietaires par quelqu un qui n y a pas acces serait
-- invisible a son deposant, citable par personne, et porterait des
-- donnees personnelles dans un prefixe reserve. On ferme donc le
-- prefixe dans les deux sens.
drop policy if exists "documents_proprietaires_bureau_insert"
  on storage.objects;
create policy "documents_proprietaires_bureau_insert" on storage.objects
  as restrictive for insert to authenticated
  with check (
    (storage.foldername(name))[1] is distinct from 'proprietaires'
    or public.is_admin()
    or public.is_secretaire()
  );

-- ⚠ CONSTATE, sans consequence : `documents_delete` (012) reserve la
-- suppression au president ou au proprietaire d une decision. Un
-- secretaire ne pourra donc pas EFFACER du bucket une designation
-- qu il a deposee. Sans effet reel — Retirer une piece jointe
-- n efface jamais l objet du Storage (orphelins assumes, 012), et
-- c est precisement ce qui rend le partage de pieces sur plusieurs
-- lignes possible depuis la 046.

-- ------------------------------------------ envois aux colotis (056)
-- ⚠ `on delete set null` et non le defaut : la chaine lots vers
-- proprietaires est en cascade, et un envoi passe est un FAIT, qui
-- doit survivre a la suppression de la personne. Sans cette clause,
-- supprimer un lot echouerait des qu un de ses titulaires a ete
-- destinataire d une campagne.
alter table communication_destinataires
  add column if not exists titulaire_id uuid
  references titulaires(id) on delete set null;

create index if not exists communication_destinataires_titulaire_idx
  on communication_destinataires (titulaire_id)
  where titulaire_id is not null;

-- ------------------------------------------------------ commentaires
-- ⚠ Ces chaines restent longues a dessein : une chaine repliee par un
-- collage demeure valide, elle garde seulement un retour a la ligne.
comment on table titulaires is
  'Une ligne par personne titulaire de droits sur un lot, rattachee a une PERIODE de propriete. Porte les roles de l article 6 des statuts du 15 septembre 2026 (indivision, demembrement, personne morale). Ne pese aucune voix — les voix suivent lots.superficie (article 9).';

comment on column titulaires.role is
  'plein_proprietaire, indivisaire, co_proprietaire (detention a deux non qualifiee, cf. migration 040), usufruitier, nu_proprietaire, representant_legal (dirigeant), mandataire (intermediaire de contact de la migration 037, JAMAIS un pouvoir d assemblee).';

comment on column titulaires.est_membre_votant is
  'Qui porte la voix du lot. Au plus un par periode en cours. Ne determine PAS le poids de la voix.';

comment on column titulaires.adresse_a_verifier is
  'L adresse postale a ete heritee de la fiche du proprietaire, elle n a pas ete declaree par cette personne. Article 28 des statuts, election de domicile en leur demeure respective.';

comment on column titulaires.destinataire_notification_pv is
  'Doit recevoir la copie du proces-verbal (article 13). Ne dit pas par quel moyen — le pli simple ou le recommande depend de la facon dont la personne a vote a cette assemblee, donnee que l application ne detient pas.';

comment on column communication_destinataires.titulaire_id is
  'La personne rapprochee dans le registre des titulaires (migration 068). Nullable, une adresse sans correspondance reste visible comme telle.';

-- ------------------------------------------------------ verification
-- La table existe, elle est vide, ses contraintes et ses index sont
-- poses, et les deux policies de Storage sont bien la.
select
  (select count(*) from titulaires)
    as titulaires,
  (select count(*) from pg_constraint
     where conrelid = 'titulaires'::regclass and contype = 'c')
    as contraintes,
  (select count(*) from pg_indexes where tablename = 'titulaires')
    as index_poses,
  (select count(*) from pg_policies
     where tablename = 'objects'
       and policyname like 'documents_proprietaires_bureau%')
    as policies_storage;
