# CLAUDE.md — Registre CS · ASL Lotissement de Rives

> ⚠ Le `CLAUDE.md` du dossier parent (`_1_PLC`) concerne le firmware **Humidor ONE / vBuilder**.
> Il n'a **aucun rapport** avec ce projet. Ignorer ses règles ici.

## Mode de travail

**Autonome.** Ne jamais demander de permission, de confirmation, ni de clarification.
Trancher et avancer. Travailler silencieusement et complètement.
Exception (non négociable) : ne pas maquiller un échec. Si un test échoue, si une étape est
sautée, si une règle statutaire n'est pas couverte → le dire explicitement.

**Langue** : réponses et UI en **français**. Voir §Conventions pour code/commentaires.

---

## Nature du projet

Registre **officiel et légal** des décisions du Conseil Syndical de l'**ASL — Lotissement de
Rives, Nernier (74140)**, France. Base juridique : **ordonnance n°2004-632**.

- **ASL** = Association Syndicale Libre — association de propriétaires d'un *lotissement*
  (pas une copropriété, pas suisse malgré le lac).
- Le **CS** (Conseil Syndical) est l'organe exécutif élu. La loi impose que ses délibérations
  soient inscrites sur un **registre spécial** et **signées**. Cette app *est* cette obligation.
- **Maquette de validation, éprouvée en conditions réelles par le CS** (`cs-rives.vercel.app`) —
  **pas encore un registre de production** : ni sauvegarde des données, ni signature électronique
  valide (le module de signature est un *mock*). La fiabilisation (Supabase Pro + sauvegardes,
  signature réelle, transfert à l'ASL) fait l'objet d'un budget demandé à l'AG. Ne pas la présenter
  comme « en production ». Une régression a néanmoins des conséquences juridiques réelles (de vrais
  membres votent sur de vraies décisions), pas seulement des tickets.

Chaîne du domaine :
**AG** vote des **résolutions** (avec budget) → une résolution engendre des **projets** → le CS
prend des **décisions** qui engagent de l'argent contre un projet ou directement contre une
résolution → **budgets consolidés** exportés en CSV pour **Foncia** (le syndic).

---

## Stack

| Sujet | Choix |
|---|---|
| Framework | React 19.2, composants fonction + hooks uniquement |
| Langage | **JavaScript ESM**, `.jsx`. **Pas de TypeScript** — ne pas en introduire |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 via plugin Vite (`@import 'tailwindcss'` + `@theme` dans `src/index.css`). **Pas de `tailwind.config.js`** |
| Routing | react-router-dom v7 (`BrowserRouter`) |
| Backend | Supabase (Auth + Postgres + RLS) |
| PDF | jspdf + jspdf-autotable |
| Dates | date-fns v4, locale `fr` |
| Lint | **oxlint** (`npm run lint`) |
| Tests | **Aucun.** Pas de runner, pas de fichiers de test |

Scripts : `dev`, `build`, `preview`, `lint`. **Pas de `test`, pas de `typecheck`, pas de `format`.**
Pas de CI, pas de hooks pre-commit. Seule barrière qualité : `npm run lint`, lancé à la main.

---

## Structure

```
src/
  main.jsx            racine React (StrictMode)
  App.jsx             toutes les routes + AuthProvider + ProtectedRoute/Layout
  index.css           Tailwind, tokens navy, .rich-text, gardes d'overflow
  lib/
    config.js         lecture env, switch BACKEND mock|supabase, constantes ORG
    api.js            façade : exporte `repo` + `authApi`, choisit le backend
    supabase.js       client supabase unique (null en mock)
    supabaseDb.js     implémentation Supabase du repo + resolveUser
    mockDb.js         backend démo localStorage, même interface + seed
    AuthContext.jsx   AuthProvider/useAuth ; isAdmin = role === 'admin'
    decisionLogic.js  PUR : tally/quorum/adoption (ARTICLE 15), nextNumero
    agLogic.js        constantes/labels de majorité AG (ne compte aucune voix)
    projetLogic.js    constantes/labels/tons de statut projet
    mandatLogic.js    HISTORIQUE DES MANDATS : origines (élection/désignation/cooptation), tri,
                      mandat en cours, référence d'AG (hors app comprise), DÉTECTION de divergence
                      avec `membres_cs` — signalée, jamais corrigée en silence
    format.js         wrappers date-fns (fr), todayISO, addBusinessDaysISO
    proprietaireLogic.js  contact officiel (source, jamais copie) + TRI du registre,
                      partagé par la LISTE et par la navigation de la FICHE
    sujetLogic.js     MÉMOIRE DU LOTISSEMENT : catégories (libres) et tris
    aideLogic.js      MANUEL par rôle — contenu VERSIONNÉ, jamais en base : il décrit ce que
                      l'app fait, donc il change avec elle. ⚠ Ne décrire que ce qui est VRAI
    csv.js            export CSV Foncia (';', décimales ',', BOM UTF-8)
    pdf.js            PDF registre + décision unique + ÉTAT DES COLOTIS pour le notaire
                      (paysage, colonnes à remplir vides) — voir §Registre des propriétaires
    pvArchiveLogic.js  ARCHIVES DES PV : lecture des noms de fichiers (PARTAGÉE avec le script
                      d'ingestion), frise et années manquantes, extraits de recherche
    communicationLogic.js  ENVOIS AUX COLOTIS : libellés de canal/statut, découpage du corps
                      (texte brut, jamais du HTML) et repérage des destinataires non rapprochés
    share.js          texte WhatsApp + URL wa.me (notification manuelle)
    signatureProvider.js  couche signature : provider mock + stub yousign
    useIsMobile.js    matchMedia <768px
  components/
    Layout.jsx        sidebar en 3 SECTIONS (Gestion / Données / Application), tableau de bord
                      en icône, menu mobile, gate ForcePasswordChange, badge démo
                      ⚠ `SECTIONS[].items[].visible` est répliqué dans `aideLogic.js` —
                      modifier l'un oblige à modifier l'autre
    ProtectedRoute.jsx  gate auth + (curieusement) exporte `PageHeader`
    ui.jsx            primitives : Button/Card/Badge/Input/Modal/EmptyState/DesktopOnly/Spinner/eur/num
                      ⚠ `cx` y est PRIVÉ (pas exporté) — composer les classes conditionnelles
                      avec un template literal, ou l'exporter d'abord
    badges.jsx        badges de statut par entité
    PiecesJointes.jsx composant CONTRÔLÉ d'envoi/liste/retrait — la liste appartient à
                      l'appelant, ce qui permet de joindre AVANT que la ligne existe
    RichTextEditor.jsx  éditeur contentEditable 3 boutons (execCommand)
  pages/              Login, ResetPassword, ForcePasswordChange, Dashboard, RegistreCS,
                      Aide (manuel écran par écran) + CommentFaire (parcours transversaux),
                      SujetList/SujetDetail (mémoire du lotissement),
                      DecisionForm/Detail, Signatures, AGList/Form/Detail,
                      ProjetList/Form/Detail, BudgetsConsolidated, Membres, Parametres,
                      CommunicationsList/CommunicationDetail (envois aux colotis),
                      PVArchivesList/PVArchiveDetail (archives des PV depuis 1955)
scripts/
  export_md.mjs       EXPORT LISIBLE de toute la base en UN fichier Markdown, pour qu'un
                      assistant relise l'état du registre d'un bloc et réponde à « qu'est-ce
                      qui manque ? ». Résout les UUID en NOMS, omet les champs vides, nomme
                      les pièces jointes, signale les chemins morts et les orphelins du
                      Storage, et termine par « points d'attention » (ce qui manque).
                      ⚠ Ce N'EST PAS une sauvegarde : il omet et interprète — ne jamais
                      restaurer depuis lui. ⚠ Contient les 50 propriétaires en clair :
                      `export/` est git-ignoré, `--sans-perso` produit une version partageable.
                      Toute table non mise en forme est dumpée brute en fin de fichier, pour
                      qu'une table future n'en disparaisse pas en silence.
  importer_envois.mjs IMPORT DE LA DERNIÈRE CAMPAGNE d'envoi aux colotis (056). Essai à blanc
                      par défaut, `--go` pour écrire, idempotent sur `(date_envoi, objet)`.
                      ⚠ **REFUSE l'import** si l'objet du journal ne correspond plus à
                      `Message_objet.txt` : les textes auraient changé depuis l'envoi, et on
                      inscrirait au registre un texte qui n'est pas celui qui est parti.
                      ⚠ **N'a PAS de garde de sauvegarde** : il n'insère que dans deux tables
                      neuves. `--archiver` copie les trois textes dans `_OLD/`, **l'AppleScript
                      n'est pas modifié**.
  importer_pv_archives.mjs  INGESTION DES PV SCANNÉS (057) : empreinte SHA-256, déduction du
                      nom de fichier, dépôt dans le bucket, extraction du texte, rapport avec les
                      ANNÉES MANQUANTES — c'est cette liste qui dit ce qu'il reste à scanner.
                      ⚠ `--hors-ligne` éprouve le nommage SANS base.
  lire_pdf.swift      COUCHE TEXTE puis OCR français (PDFKit + Vision de macOS). ⚠ Ni tesseract,
                      ni ocrmypdf, ni pdftotext, ni Homebrew sur ce Mac — vérifié. Un seul appel
                      pour tous les fichiers : `swift x.swift` recompile à chaque exécution.
  lire_eml.py         LECTURE D'UN .eml (en-têtes, destinataires, corps texte) par le module
                      `email` de Python. ⚠ Un parseur maison rendrait du charabia : en-têtes
                      repliés, noms en RFC 2047, corps multipart en quoted-printable.
                      ⚠ Lit `To` + `Cc` + `Bcc` — s'en tenir au `Bcc` effaçait 14 destinataires
                      réels du message du 18/08.
  journal_envoi.mjs   ANALYSE PURE du journal d'envoi, SANS Supabase — donc vérifiable avant
                      que la migration ne soit passée. ⚠ Le journal est en **retours chariot
                      seuls** (`\r`) : un découpage sur `\n` rend UNE ligne. ⚠ La date suit la
                      **locale du Mac** (anglais ou français) et n'est **jamais devinée** : un
                      format non reconnu fait échouer l'import, il ne retombe pas sur aujourd'hui.
  backup.mjs          sauvegarde de la base (tables découvertes via l'OpenAPI PostgREST)
  restore.mjs         restauration — ⚠ ordre d'insertion NON codé en dur : insertion par
                      PASSES, ce qui échoue sur une clé étrangère repasse au tour suivant.
                      Essai à blanc par défaut, refuse une cible non vide. Ne restaure PAS
                      `auth.users` : les comptes se recréent à la main, même e-mail exact
  creer_groupes_colotis.py  constitue les 3 groupes d'envoi dans Contacts (Apple) depuis le
                      registre ; ⚠ SUPPRIME et reconstruit les groupes à chaque exécution
  REQUETE_export_destinataires.sql  la requête qui l'alimente
                      ⚠ Le CSV produit contient 50 noms et adresses : JAMAIS dans le dépôt
supabase/
  schema.sql          schéma + RLS + helpers — source de vérité pour une install neuve
  seed.sql            bootstrap membres_cs
  nettoyage.sql       DESTRUCTIF, ne garde que le président
  migrations/         001..006, voir §Supabase
docs/                 TECHNIQUE.md (POINT D'ENTRÉE d'un développeur qui reprend le projet),
                      DEPLOIEMENT.md, TRANSFERT_ASL.md, GUIDE_A_comptes_membres.md
public/favicon.svg    seul asset public
```

**Fichier parasite** : `/npm` à la racine est un `ps` capturé par erreur, commité. À supprimer.

---

## ⚠ Statuts en cours de révision (2026-09-15)

L'AG du 15 septembre 2026 vote un **projet de nouveaux statuts**, dont **Me Garnier adaptera la
rédaction finale pour que le mode de fonctionnement de l'application soit conforme**. Le sens de la
dépendance s'inverse donc : jusqu'ici l'app suivait l'art. 15, désormais les statuts décrivent ce
que l'app fait.

Trois conséquences, à garder en tête avant toute modification du vote ou de l'adoption :

1. **Ce que fait l'app devient la référence rédactionnelle.** Les règles ci-dessous ne sont plus
   seulement une lecture de l'art. 15 : elles sont ce que les statuts vont décrire. Les changer
   après l'AG, c'est risquer de sortir des statuts.
2. **Plusieurs règles sont INTERNES et plus strictes que l'art. 15 actuel** — le quorum > 50 %,
   la garde d'engagement (trésorier OU président doit voter pour). Si elles passent dans les
   statuts, elles deviennent statutaires, donc bien plus lourdes à assouplir ensuite.
3. **Ce que l'app ne fait PAS doit être décrit aussi** : pas de représentation (« ou représentés »),
   vote self-only, pas de clôture automatique du vote. Un silence des statuts sur ces points
   rouvrirait la question.

⚠ **Tant que les nouveaux statuts ne sont pas adoptés ET connus, l'art. 15 ci-dessous reste la
règle en vigueur.** Ne pas anticiper une rédaction qu'on n'a pas lue. Relire ce paragraphe après
l'AG et mettre à jour la section suivante.

---

## ARTICLE 15 des statuts — la règle qui gouverne tout

> « Ses décisions sont prises à la majorité des membres présents ou représentés. […] En cas de
> partage des voix, celle du président est prépondérante. Les délibérations sont inscrites […]
> sur un registre spécial […] et signé par tous les membres présents à la délibération. »

Encodé dans `src/lib/decisionLogic.js` (`tally`). **Avant toute modification du vote, de
l'adoption ou de la signature : relire l'art. 15 lui-même.** Ne pas faire confiance au README,
ni aux commentaires, ni à une règle « validée » lors d'une session précédente — l'historique
montre des règles convenues le 14/07 et invalidées le 15/07.

- **Présent = a voté.** « Absent » n'est pas un choix, c'est l'absence de ligne de vote.
- **Vote self-only** : personne ne vote pour autrui.
- **Adoption = majorité des membres PRÉSENTS** : `pour * 2 > présents`, avec
  `présents = pour + contre + abstention`. **L'abstention reste au dénominateur** et fait
  obstacle à l'adoption. (Corrige la règle « majorité des voix exprimées », qui adoptait des
  décisions que l'art. 15 rejette.)
- **Partage** : `pour * 2 === présents` → **voix prépondérante du président**. S'il n'a pas
  voté, personne ne départage → **rejetée**.
- **Quorum : > 50 % des membres actifs ont voté.** ⚠ Règle **INTERNE**, délibérément plus
  stricte : l'art. 15 n'impose **aucun** quorum au CS. Ne pas la présenter comme statutaire.
- **Signataires = tous les membres présents, y compris « Contre »**. Les absents n'ont pas de
  ligne de signature.
- **Non couvert, documenté, assumé** : la **représentation** (« ou représentés »). Un membre
  sans vote est absent, jamais représenté. ⚠ À signaler pour la rédaction des nouveaux statuts :
  c'est l'écart le plus visible entre l'art. 15 et ce que fait l'application.

### Enregistrement (l'« acte »)
Président seul, quorum atteint, desktop seul. Fige `statut`, `quorum_atteint` et un
`composition_snapshot` du CS (le PDF reste fidèle après un changement de mandat). Pose
`enregistree = true` → **verrou définitif** : ni édition, ni vote, ni suppression. Écrit une
ligne dans `decision_status_history`.

### Cycle de vie d'une décision (migration 026) — `phase` ≠ `statut`
> **`phase`** = où en est la décision : `brouillon` → `planifiee` → `ouverte_au_vote`, +
> `annulee` (retirée AVANT ouverture du vote). **`statut`** = résultat de la délibération
> (`en_cours` → `adoptee`/`rejetee`). **Ne jamais fusionner les deux** : les budgets, le CSV
> Foncia et le PDF lisent `statut` et ignorent le cycle. La spec les fusionnait ; la
> décomposition est l'écart assumé, documenté en tête de la migration 026.

- **UN BROUILLON N'APPARTIENT QU'À SON AUTEUR** (arbitrage Pascal 2026-08-25). Tant qu'une
  décision est en `brouillon` — `planifiee` comprise, c'est un brouillon daté — **seul son auteur
  la voit, la modifie, la soumet ou la supprime. Le président n'y a AUCUN droit de plus qu'un
  autre membre.** Demander une décision au conseil n'est pas un pouvoir présidentiel : tout membre
  actif rédige et soumet les siennes (modèle de propriété, 006) ; la prérogative propre du
  président est l'**acte** (enregistrer une délibération votée) et la signature. **Ne pas
  réintroduire d'exception `is_admin()` ici.**
  - **Exception assumée** à « tout membre connecté lit tout », qui vaut partout ailleurs.
  - **TROIS policies restrictives**, une par verbe : `decisions_avant_soumission_privee` (select),
    `decisions_brouillon_update_auteur`, `decisions_brouillon_delete_auteur`. Il en faut trois —
    **un SELECT fermé n'empêche ni l'UPDATE ni le DELETE** d'une ligne ciblée par son id, et
    `write_admin` est un `for all` permissif (les permissives se cumulent en OU).
  - Dès qu'elle quitte le brouillon, la décision est visible de **tous**, `annulee` comprise :
    annuler est l'acte délibéré de laisser une trace ; qui n'en veut pas **supprime**.
  - `decisions_historique` **et** les pièces jointes suivent la visibilité de leur décision
    (`historique_suit_la_decision`, `documents_read_auth` révisée) — sinon le texte et les devis
    cachés fuiraient par là.
  - ⚠ Les sous-requêtes des autres policies qui lisent `decisions` subissent cette RLS.
  - ⚠ Effet de bord assumé : le brouillon d'un membre devenu inactif n'est plus accessible à
    personne.
- **Conséquence directe : la numérotation passe en base.** `prochain_numero_decision(annee)`,
  `security definer`. Un « max + 1 » côté client sur `listDecisions()` retomberait sur un numéro
  déjà pris, puisqu'il ne voit plus les brouillons des autres → violation de l'unique. Le numéro
  n'est toujours pas *réservé* (deux créations simultanées peuvent collisionner, comme avant).
- **Suppression, deux régimes qui ne se recouvrent pas** : décision **non soumise** → son auteur
  seul (`decisions_owner_delete`) ; décision **soumise et non enregistrée** → le président seul
  (`write_admin`, ≤ 1 vote). **`Annuler` ≠ `Supprimer`** : annuler garde la trace au registre avec
  motif obligatoire, supprimer n'en laisse aucune.
- **On ne vote que sur `ouverte_au_vote`** (policies RESTRICTIVES `votes_open_only_insert/update` —
  restrictives parce que `votes_admin` est un `for all using(is_admin())` et que les permissives se
  cumulent en OU). Ni quorum, ni enregistrement, ni « à voter » avant la soumission.
- **Enregistrée ⇒ `phase = 'ouverte_au_vote'`** : contrainte `decisions_enregistree_phase_check`.
- **Gel du texte à l'ouverture** : `contenu_gele` = `titre + "\n\n" + description`, `hash_contenu` =
  SHA-256 hex UTF-8. Titre et description ne sont **plus modifiables**, y compris par l'auteur.
  La garde porte sur `contenu_gele is not null`, **pas** sur la phase → les décisions antérieures
  à 026 gardent leur comportement (pas de gel rétroactif). Montant, rattachement et **pièces
  jointes restent modifiables** jusqu'à l'enregistrement (un devis arrive souvent après).
  ⚠ Même recette exactement en SQL (`decisions_cycle_guard`) et en JS (`contenuAGeler` + `sha256Hex`
  du mock) — modifier l'une oblige à modifier l'autre.
- **À l'ouverture, `date_publication` est REPOSÉE au jour réel** et `date_limite_reponse` à
  + `delai_vote_jours` jours **ouvrés**. Ce n'est pas cosmétique : `date_publication` détermine la
  **composition du CS appelée à voter** (`activeMembersAt`) et le dénominateur du quorum — c'est
  tout l'objet du besoin (voter après l'AG, avec le NOUVEAU conseil).
- **Un seul point d'application** : le trigger `decisions_cycle_guard` (transitions, motif
  d'annulation obligatoire, gel, version + `decisions_historique`, recalage des dates). Le repo
  Supabase ne fait que des `update` ; le mock a un miroir explicite (`appliquerCycle`).
- **Ouverture automatique : pg_cron horaire** (`ouvrir_decisions_planifiees`), **plus** un filet
  applicatif (`useOuvertureAutomatique`, monté dans `Layout`) qui appelle la même fonction au
  chargement. Redondance voulue : un pg_cron non activé ferait qu'une décision planifiée ne
  s'ouvrirait **jamais**, en silence. **Pas** de Vercel Cron / route API : le projet n'a aucun code
  serveur et une route de cron exigerait la `SERVICE_ROLE_KEY` (qui contourne toute la RLS) dans
  Vercel. Idempotent ; `cron_runs` ne journalise que les exécutions non vides.
- **Rien ne s'adopte tout seul.** Pas de clôture automatique du vote, pas de `cloturee_le` :
  clôturer = calculer et figer le résultat, c'est-à-dire l'**acte du président**
  (`enregistree`/`date_enregistrement`). La planification ouvre le vote, elle ne l'emporte jamais.
- **`visibilite`** (`cs_seul` / `colotis`) est affichée au registre et sur la fiche, et le
  président peut la changer **même sur une décision enregistrée** — publier n'est pas délibérer,
  le verrou de l'art. 15 protège le TEXTE. Tracée par le trigger `decisions_audit_visibilite`
  (027), premier écrit dans `audit_log` côté Supabase. ⚠ Elle **n'a toujours aucun lecteur** : le
  registre colotis est hors périmètre, le champ ne masque rien. L'avertissement affiché sur la
  fiche doit rester tant que c'est vrai.
- **PAS de ratification en réunion** (migration 027, arbitrage Pascal 2026-08-25). Le §4 de la spec
  proposait un champ `ratifiee_en_reunion_le` ; il a été posé par la 026 puis **retiré le jour même** :
  « le but de cette app est de ne PAS avoir à ratifier ces décisions en réunion ». Organiser la
  ratification dans l'outil, c'était installer la pratique qu'il existe pour éviter.
  **Ne pas le réintroduire.** Le point juridique se règle par l'autre bout : de NOUVEAUX STATUTS
  sont soumis au vote de l'AG du 15 septembre 2026, et Me Garnier en adaptera la rédaction finale
  pour que le fonctionnement de l'application soit conforme — cf. §Statuts en cours de révision.
- **Non implémenté, assumé** : `notifications_decision` et les relances e-mail (§6 de la spec) —
  aucun envoyeur n'existe (cf. backlog e-mail). **Personne n'est prévenu à l'ouverture** : l'auteur
  doit toujours cliquer « Prévenir le CS ».
- Le **PDF du registre exclut** brouillons et décisions planifiées (ce ne sont pas des
  délibérations) ; les **annulées y restent**, verdict « ANNULÉE ».

### Journal de bord des projets (migration 029) ≠ `audit_log`
> Deux journaux, deux usages — **ne pas les confondre ni les fusionner**.
> `audit_log` : **automatique, technique, immuable** (qui a changé quoi dans l'app).
> `journal_projet` : **saisi à la main, métier, corrigeable** (ce que l'équipe a FAIT).

- **DEUX DATES à dessein** : `date_action` (quand ça s'est passé — **modifiable**, c'est la demande)
  et `created_at` (quand ça a été saisi — **jamais** modifié). Les confondre daterait les faits du
  jour où on a pensé à les écrire. Le journal se **trie sur `date_action`** : une visite du 12 notée
  le 20 se range au 12. ⚠ `created_at` est **stocké mais plus affiché** (Pascal, 2026-08-26) : seule
  la date de l'action intéresse le lecteur. Une entrée tient sur **une ligne** — date, sujet,
  boutons, auteur — le sujet prenant la place restante et repassant seul à la ligne s'il est long.
- **L'AUTEUR seul corrige et supprime sa ligne** (`journal_projet_self_update/delete`) — le chef et
  l'adjoint pilotent le projet, ils ne réécrivent pas le compte rendu d'un autre. Le président garde
  tout. **Aucun verrou de temps** : ce n'est pas une délibération, elle n'entre pas au registre.
- **PIÈCES JOINTES SUR L'ENTRÉE** (migration 050, `journal_projet.documents`, validée en usage réel
  le 2026-09-10). ⚠ **Ce n'est pas un doublon des pièces du projet** : celles du projet le
  *décrivent* et ne sont datées de rien, celles d'une entrée sont attachées à un **fait daté**.
  Trois devis rangés en vrac sur la fiche ne disent plus lequel est arrivé avant la visite du 12 —
  c'est exactement ce que les deux dates de la 029 existent pour tenir. **Ne pas fusionner les deux
  emplacements.**
  - ⚠ Le chemin porte l'id du **PROJET**, pas de l'entrée : le projet existe au moment de l'envoi,
    l'entrée pas encore. Même raison qu'en 046. Comme c'est déjà le préfixe des pièces du projet,
    **aucune policy de Storage ni de table à ajouter** — vérifié, pas supposé.
  - Affichées **seulement s'il y en a** : un intitulé vide sur chaque ligne alourdirait un journal
    dont l'entrée tient sur une ligne.

### Historique des mandats du CS (migration 051) — `mandats_cs` RACONTE, `membres_cs` OPÈRE
> **LE MEMBRE EST STABLE, LE MANDAT EST UNE PÉRIODE** — même patron que
> `lots` / `proprietaires`. Avant la 051, `membres_cs` portait UN mandat à plat
> (`role`, `date_election`, `date_fin`, `ag_election`) : une réélection ÉCRASAIT l'élection
> précédente, une désignation au bureau écrasait le rôle tenu avant.

- ⚠ **`membres_cs` GARDE ses colonnes de mandat, et reste l'état opérant.** Deux mécanismes en
  dépendent et **n'ont pas été déplacés** : les helpers de sécurité (`is_admin()`,
  `is_tresorier()`, `is_secretaire()`) lisent `membres_cs.role`, et **`activeMembersAt` lit
  `date_election` / `date_fin`** pour établir la composition appelée à voter et **le dénominateur
  du quorum**. Brancher le quorum sur l'historique changerait une règle de l'art. 15 par effet de
  bord. **Écart assumé et documenté**, pas un oubli.
- ⚠ **L'HISTORIQUE EST SAISI, PAS DÉDUIT.** Un trigger qui ouvrirait un mandat à chaque changement
  de `role` ou de `date_election` a été écrit puis **écarté** : il ne sait pas distinguer une
  **réélection** d'une **correction de saisie**, et corriger une faute de frappe aurait fabriqué
  une élection qui n'a jamais eu lieu. L'écran **pose la question** (« nouveau mandat » /
  « correction ») à celui qui sait. **Ne pas réintroduire d'automatisme ici.**
- ⚠ **`ag_id` NULLABLE + `ag_libelle` texte** : c'est le cœur de la demande. Les AG antérieures à
  l'application n'y figurent pas et n'y figureront jamais ; leur référence est saisie en toutes
  lettres, telle qu'elle se lit au PV. **On ne fabrique pas une AG fictive pour satisfaire une clé
  étrangère.** Même raisonnement que le président de séance jamais obligatoire à la convocation.
- **`origine`** (`election` / `designation` / `cooptation`) sépare ce que l'art. 14 sépare :
  **l'AG élit** les membres, **le président désigne** le trésorier et le secrétaire parmi eux.
  Ranger une désignation sous « élu par l'AG » prêterait à l'assemblée un acte qu'elle n'a pas fait.
- **Un seul mandat en cours par membre** : index partiel `mandats_cs_en_cours_par_membre`, exactement
  le rôle de `proprietaires_actuel_par_lot`. D'où l'**ORDRE IMPOSÉ** à la réélection — clore d'abord,
  ouvrir ensuite. Non atomique et assumé ; si la seconde écriture échoue, `divergences()` l'affiche.
- ⚠ **`membres_cs.email` est devenu NULLABLE.** Inscrire l'élection de 2018 suppose d'inscrire ceux
  qui siégeaient alors, dont certains n'auront jamais de compte : `not null` obligeait à **inventer
  une adresse**. Aucun effet sur la sécurité (une adresse nulle ne matche aucun JWT). L'écran
  continue de l'exiger d'un membre **actif**, qui doit se connecter.
- **Lecture ouverte à tous les membres**, écriture au président. ⚠ Ce n'est **pas** le registre des
  propriétaires : la composition du conseil figure déjà au registre, aux PV d'AG et au bas des PDF.
- **L'AG VOTE UNE DURÉE, ET LA FIN EN EST CALCULÉE** (migrations 052 puis 053, demandes Pascal
  2026-09-12). `duree_annees` = **ce que l'AG a voté** (1, 2, 3 ans) ; `date_fin` = **le TERME**,
  que l'écran calcule (`date_debut` + durée) et **pose dans le champ** à la saisie, corrigeable si
  la période s'est close avant (démission, départ). ⚠ La 052 avait laissé l'échéance à l'affichage
  seul ; en usage, cette pureté coûtait une addition mentale par membre, dans un registre où une
  erreur d'un jour est une erreur de fond.
  - ⚠ **UN TERME DÉPASSÉ NE FAIT SORTIR PERSONNE.** Il ne touche ni `membres_cs.actif`, ni
    `membres_cs.date_fin`, donc ni `activeMembersAt` ni le **dénominateur du quorum** : un membre élu
    pour un an siège **jusqu'à l'AG qui le renouvelle** — cas ordinaire, pas une anomalie. Badge
    « Échu — à renouveler », et il continue de voter. On **signale**, on ne révoque pas. Même esprit
    que « rien ne s'adopte tout seul ».
  - ⚠ **`mandatEnCours` = LE DERNIER COMMENCÉ**, plus « celui sans date de fin » : ils en portent
    tous une désormais. Chercher une fin nulle aurait annoncé qu'un conseil en exercice n'a aucun
    mandat. L'unicité du mandat courant devient **structurelle** (un maximum n'a qu'une valeur) et
    l'index partiel `mandats_cs_en_cours_par_membre` n'a plus d'invariant à porter — conservé, sans
    dommage.
  - **`finMandat()` retombe sur l'échéance calculée** quand `date_fin` est nulle : les mandats
    saisis avant la 053 portent une durée sans date, et sans cette retombée ils ne seraient jamais
    signalés échus — donc muets précisément sur les lignes les plus anciennes.
  - **Nullable, sans défaut** : la durée de bien des mandats anciens n'est pas connue. `not null
    default 1` ferait affirmer au registre une durée que personne n'a votée.
  - Contrainte `> 0` **sans plafond** : les statuts en révision pourraient retenir trois ans.
  - ⚠ **Aucune alerte de divergence sur un mandat échu** : elle ferait clignoter tout le conseil dès
    le lendemain du terme et, devenue permanente, ne serait plus lue le jour d'une vraie contradiction.
- **DEUX LISTES, PAS UNE LISTE FILTRÉE** (écran Membres, Pascal 2026-09-12) : « Conseil syndical
  actuel » et « Anciens membres », chacune son tableau titré. Une case « afficher les anciens »
  obligeait à lire la colonne Statut ligne à ligne pour savoir qui compose le conseil — la première
  question que l'écran doit trancher d'un coup d'œil. ⚠ **Un seul composant** rendu deux fois
  (`SectionMembres`) : dupliquer le tableau garantissait qu'une colonne ajoutée un jour n'existerait
  que d'un côté. La colonne « Statut » ne subsiste que chez les anciens, où elle porte la **date** de
  fin de fonction ; côté conseil en exercice, une colonne de badges « Actif » identiques n'apprend rien.
- ⚠ **Les `null` de la base traversent le spread d'un formulaire** (`sansNull`, `Membres.jsx`).
  `{ ...EMPTY, ...ligne }` n'est PAS suffisant : `null` écrase la valeur vide du modèle (seul
  `undefined` laisse la valeur de gauche), et un `.trim()` plante. Normaliser champ par champ est ce
  qui a produit le bug — deux champs traités, le troisième oublié. **Les traiter tous, une fois.**
- **Divergences SIGNALÉES, jamais corrigées en silence** (`divergences()`, `mandatLogic.js`) :
  aligner automatiquement réécrirait soit la sécurité (`role`), soit l'histoire, sur une supposition.
  ⚠ La date se compare à la dernière **élection**, pas au mandat en cours — un trésorier désigné en
  cours de mandature a légitimement une période qui commence après son élection.

### Modèle de propriété (migration 006)
> Tout membre actif crée et devient owner ; l'owner seul modifie et notifie ; le président
> garde l'acte (enregistrement) et la signature.

Le président conserve tout via `write_admin`. Suppression : président seul, non enregistrée,
et **zéro vote**.

### Autres règles métier figées
- Numérotation décision **`AAAA-NNN`**, attribuée **À LA SOUMISSION AU VOTE** et nulle part
  ailleurs (migration 034, trigger `decisions_cycle_guard`). **Un brouillon n'a PAS de numéro**
  (`numero` est nullable) : abandonné, il ne laisse aucun trou — et devant un registre légal, un
  numéro manquant se lit comme une délibération retirée. La numérotation suit donc l'ordre réel des
  soumissions, l'année étant celle de l'ouverture. Afficher via `numeroDecision()`.
  ⚠ `ouvrir_decisions_planifiees` traite les décisions **une par une, en boucle** : dans un update
  de masse, toutes les lignes partageraient le même instantané et tireraient le même numéro, ce qui
  ferait échouer tout le cron sur l'unicité. **Ne pas « optimiser » en update unique.**
  ⚠ `prochain_numero_decision` (RPC) a été **supprimée** : plus d'appelant.
- `date_limite_reponse` = publication **+ `delai_vote_jours` jours ouvrés** (`addBusinessDaysISO`),
  recalculée automatiquement jusqu'à édition manuelle. **Masquée dès que la décision est
  enregistrée** (liste et fiche) : elle ne concerne que le vote en cours, la date de l'acte la
  remplace.
- **Tri du registre** : `date_publication` **décroissante**, puis `numero` **décroissant** — le
  second critère rend l'ordre déterministe pour les décisions du même jour et aligne les deux
  backends. L'écran remonte ensuite brouillons et planifiées en tête.
- Résolution **verrouillée** dès qu'une décision ou un projet la référence. AG non supprimable
  avec décisions attachées.
- **Projet non supprimable dès qu'une décision ENREGISTRÉE y est rattachée** (règle Pascal : « dès
  qu'on a engagé de l'argent »— l'engagement vient toujours d'une décision enregistrée et adoptée).
  Doublé en base par le trigger `projets_delete_guard` (migration 010) : `decisions.projet_id` étant
  en `on delete set null`, supprimer le projet **modifiait une délibération figée**, en silence et
  hors RLS (une action de FK échappe aux policies de la table enfant). Pas de `on delete restrict` :
  détacher une décision **non** enregistrée reste légitime.
- **Statut projet entièrement DÉRIVÉ** (`computeProjectBudgets`), jamais saisi — `projets.statut`
  a été **supprimée** (migration 011). Deux couches : le statut *naturel*, puis, s'il existe,
  l'effet de la **dernière décision enregistrée ET adoptée** portant un `projet_action`
  (`suspendre` → `suspendu`, `terminer` → `termine`, `reprendre` → rend la main au naturel).
  Cycle resserré à **QUATRE** états le 2026-08-26 :
  `en_preparation` → `en_cours` → (`suspendu` ⇄ `en_cours`) → `termine`.
  Le **naturel** (tant qu'aucune délibération n'en décide autrement) : `date_ouverture` **à venir**
  → `en_preparation`, sinon → `en_cours`.
  - ⚠ **`ouvert` a été SUPPRIMÉ**, fondu dans `en_cours`. Il distinguait « ouvert mais rien
    d'engagé » de « en cours » ; depuis que `en_preparation` existe, la nuance ne portait plus
    rien. C'est pourquoi `engage` n'entre **plus** dans le calcul du statut.
  - `en_preparation` corrige un vrai faux : un projet calé après une AG était annoncé « Ouvert » dès
    sa création. **Aucune colonne, aucune migration** — même patron que « AG a eu lieu »
    (`effectiveAGStatut`, 023) : dérivé de la date, jamais stocké, le projet bascule seul le jour dit.
- **Suspendre, reprendre ou terminer un projet est une délibération du CS** (arbitrage Pascal
  2026-07-16, **reconfirmé le 2026-08-26**) : ni le chef de projet, ni son adjoint, ni le président
  ne le font seuls, et il n'existe volontairement **aucun bouton** pour ça.
  ⚠ Un bouton « suspendre / reprendre » a été demandé puis **retiré le jour même**, avant livraison.
  Ce qu'il faut retenir si l'idée revient : un bouton obligerait à **STOCKER** la suspension, donc à
  rouvrir la porte que la migration 011 avait fermée en supprimant `projets.statut`. Aujourd'hui le
  statut ne coûte aucune colonne. Cela se saisit dans `DecisionForm`
  (`decisions.projet_action`, visible seulement si la décision cible un projet) et ne prend effet
  **qu'à l'enregistrement, décision adoptée** — donc après quorum et vote. Une décision rejetée ou
  non enregistrée n'a aucun effet.
- **« Terminé » est RÉVERSIBLE** (choix explicite de Pascal) : la dernière décision enregistrée
  l'emporte, donc le CS peut rouvrir — et cette réouverture est elle-même une délibération tracée.
  Ne pas confondre avec l'enregistrement d'une décision, lui définitif.
- **CYCLE D'UNE AG** (023 puis 055) : `preparation` → `convoquee` → **« a eu lieu »** *(dérivé de la
  date)* → **`pv_envoye`** → **« clôturée de plein droit »** *(dérivée du délai)* → `cloturee`
  *(acte manuel)*. + `annulee`. ⚠ **Deux des cinq états ne sont pas stockés.**
  - **`date_envoi_pv`** : c'est **l'envoi du PV** qui fait courir le délai de contestation, **pas la
    date de séance** ni celle de rédaction. Contrainte `ag_pv_envoye_exige_une_date` : sans elle, le
    statut serait un état dont la conséquence ne peut pas être calculée.
  - ⚠ **LA CLÔTURE DE PLEIN DROIT EST DÉRIVÉE, JAMAIS ÉCRITE** (`closeDePleinDroit`) — aucun
    pg_cron, aucun trigger. Une date d'envoi corrigée doit corriger la clôture, et une contestation
    inscrite après coup doit rouvrir l'assemblée : un statut écrit aurait figé l'inverse. Elle
    **FIGE** l'AG autant qu'une clôture manuelle (`agFigee`) — c'est son objet.
  - **Une contestation SUSPEND la clôture**, sans limite de temps, et rouvre l'AG. ⚠ Elle reste
    **inscriptible après la fermeture automatique** : une contestation déposée le dernier jour
    s'inscrit le lendemain, et la refuser gèlerait une clôture que le droit ne connaît pas.
    ⚠ L'application **ne juge jamais** du bien-fondé : elle constate, et n'en tire que la seule
    conséquence qu'elle sache tirer.
  - **Délai en paramètre** (`delai_contestation_mois`, défaut **12**). ⚠ 12 est la valeur donnée par
    Pascal (2026-09-18), **pas une règle lue** — les statuts en révision peuvent la fixer autrement.
- **Une AG se planifie avant d'avoir lieu.** À la convocation, le **président de séance est
  inconnu** (il est désigné *en* séance) → jamais obligatoire. Ne pas le rendre requis « pour
  la propreté de la donnée » : cela force à inventer un nom, donc à écrire une information
  fausse dans un registre légal.
- **Cycle d'une résolution** : `a_voter` (inscrite à l'ordre du jour, AG pas encore tenue) →
  `adoptee` / `rejetee` / `retiree`. `a_voter` est le **défaut**.
- **Seule une résolution `adoptee` alloue un budget.** Une résolution à voter, rejetée ou
  retirée n'alloue rien : son montant n'est qu'une proposition. Porté en un seul point,
  `computeAGBudgets` (`mockDb.js`) — qui alimente aussi les cibles d'engagement de
  `DecisionForm`, donc on ne peut pas engager sur un budget non voté.
- Budget : `engagé = engagements directs (enregistrées + adoptées seulement) + budgets alloués
  aux projets`.
- **C'est la RÉSOLUTION qui pointe son projet** (`resolutions_ag.projet_id`), jamais l'inverse.
  Une colonne scalaire ne contenant qu'une valeur, « une résolution ne finance qu'un projet »
  est **structurel** — rien à vérifier. Le sens inverse est libre et voulu : **plusieurs
  résolutions peuvent financer le même projet** (rallonge votée l'année suivante, phases) →
  **pas d'unique sur `projet_id`**. `on delete set null` : supprimer un projet **détache** ses
  résolutions, une résolution d'AG survit toujours à un projet du CS.
- **Le budget d'un projet est DÉRIVÉ, jamais stocké** : somme des `budget_alloue` des
  résolutions **adoptées** qui le pointent (`computeProjectBudgets`). L'AG vote une enveloppe,
  le CS ne la réécrit pas — le champ n'est ni saisi ni modifiable. Le stocker créerait une
  divergence dès qu'une résolution est ajoutée ou change de statut. Idem pour l'**AG d'origine**
  (`projet.ags`) : un projet financé sur deux exercices a deux AG — d'où l'absence de
  `projets.ag_id` et de `projets.budget_alloue` (migration 009).
- Le prédicat **`ouvreUnBudget(r)`** (`mockDb.js`, exporté) porte « seule une résolution adoptée
  et dotée alloue ». Lu par `computeAGBudgets` **et** `computeProjectBudgets` : le dupliquer
  ferait qu'une rallonge encore `a_voter` gonflerait un budget sans vote de l'AG.
- Une enveloppe rattachée à un projet y passe **en entier** (indivisible) → son restant côté AG
  est nul et `DecisionForm` ne la propose plus en engagement direct : on engage sur le projet.
- **RÉSULTAT DU VOTE SAISI DANS LA LISTE** (`AGDetail`, Pascal 2026-09-16, au lendemain de l'AG) :
  un menu déroulant par ligne. Saisir une AG, c'est renseigner quinze résultats d'affilée ; ouvrir
  puis refermer une modale pour chacun était le vrai coût de l'écran.
  - ⚠ **TROIS VERROUS, dont un seul est une friction voulue** (`voteVerrou`, qui renvoie `dur`) :
    une **décision** rattachée ou une **enveloppe finançant un projet** sont des refus du dépôt
    (`updateResolution` throw) — ouvrir la modale n'y changerait rien, on ne propose donc même pas
    le lien. **`adoptee` est la friction demandée** : le résultat reste modifiable, mais il faut
    **ouvrir la résolution**. Une adoption ouvre un budget ; la défaire d'un coup de menu au milieu
    d'une liste retirerait une enveloppe sans que personne ne le voie.
  - ⚠ Un menu qui échouerait en silence serait pire que pas de menu : l'erreur du repo est affichée
    en clair dans la carte.
  - **Les deux montants d'une enveloppe affectée** sont montrés : l'**apport de cette résolution**
    et le **budget total du projet**. Plusieurs résolutions, parfois de plusieurs AG, abondent le
    même projet — n'afficher que le premier ferait croire que l'enveloppe votée ici est tout le
    budget. Un bandeau récapitule adopté / affecté / restant à affecter.
- **Rattachement piloté depuis la fiche AG** (« Ouvrir un projet » / « Rattacher à un projet
  existant »), pas depuis `ProjetForm` — l'AG vote, puis le CS affecte. `resolution_ids` passé à
  `repo.createProjet` est un champ **virtuel** : le repo le retire du payload et pose
  `resolutions_ag.projet_id`. En Supabase c'est **non atomique** (insert + update) : le projet
  est supprimé si le rattachement échoue, pour ne pas laisser de projet à 0 €.
- **Les votes d'AG sont au prorata des superficies et restent dans le PV.** L'app **ne calcule
  jamais l'adoption** d'une résolution : `statut` est posé à la main et `majorite_requise` reste un
  libellé qu'aucune logique n'applique (`agLogic.js`). ⚠ Depuis la **migration 054** elle peut
  **enregistrer et AFFICHER** les m² pour/contre/abstention — elle **constate**, elle ne décide pas.
  Ne pas en déduire l'adoption sans avoir lu les **nouveaux statuts**.
- **m² ET POURCENTAGES (migration 054)** — assiette des voix en AG.
  - ⚠ **LE TOTAL EST FIGÉ SUR CHAQUE AG** (`assemblees_generales.m2_total`), le paramètre
    `m2_total_lotissement` ne servant qu'à **pré-remplir**. Demande expresse de Pascal
    (2026-09-16) : « il ne faut pas que ça change les % de participation ». Sept colotis ont
    demandé à sortir ; le jour où le total baisse, une AG réputée avoir réuni 52 % en afficherait
    57 % sans que personne n'ait rien fait. Même patron que `composition_snapshot`.
    **Ne jamais « simplifier » en calculant le taux sur le paramètre.**
  - ⚠ **LE DÉNOMINATEUR DÉPEND DE LA MAJORITÉ REQUISE** (`denominateurResolution`), règle Pascal
    (2026-09-16) : **simple → m² PRÉSENTS ou représentés** ; **absolue**, **double qualifiée** et
    **unanimité → TOTAL des m² du lotissement**.
  - ⚠ **L'UNANIMITÉ SE MESURE SUR TOUS LES COLOTIS, PAS SUR LES PRÉSENTS** : « si 1 dit non, ou
    s'abstient, ou ne participe pas, ce n'est pas approuvé » (Pascal). **L'absence fait obstacle à
    l'unanimité** au même titre qu'un vote contre. **Ne pas la rapporter aux présents** — l'erreur a
    été commise et livrée le 2026-09-16 : une résolution approuvée par tous les présents d'une séance
    à 54,7 % de participation affichait « 100 % », soit une unanimité que 45 % des colotis n'avaient
    jamais donnée. Rapporté au total, le pourcentage **révèle** au contraire qu'elle n'est pas atteinte.
  - L'écran **affiche toujours le dénominateur employé en toutes lettres** : un pourcentage dont la
    base est invisible n'est pas vérifiable.
  - Les trois pourcentages **ne font pas forcément 100 %** : le reste (`nonExprime`) est montré,
    comme les « non voté » du registre des décisions.
  - **Incohérence SIGNALÉE, pas corrigée** : des m² exprimés supérieurs aux présents est une faute
    de saisie — l'écran le dit, le PV tranche.
- **`parametres` (clé/valeur, 054)** : réglages modifiables **sans redéploiement**. ⚠ **Pas la
  somme des `lots.superficie`** — ce registre est incomplet par construction, et surtout réservé
  **président/secrétaire** (035) : un trésorier verrait un trou là où les autres voient un taux,
  alors que la participation figure au PV que tout coloti reçoit. Lu par tous, écrit par le président.
  - **GESTIONNAIRE (syndic) en haut de la barre de gauche** (`gestionnaire_societe` / `_nom` /
    `_email` / `_telephone`, aucune migration — la table existait). **Aucune colonne, aucune
    table** : c'est un contact unique, qui change à chaque changement de syndic, et qu'on appelle
    depuis n'importe quel écran. Les quatre champs sont **facultatifs et indépendants** : seul ce
    qui est renseigné s'affiche. ⚠ **Rien n'est affiché aux non-présidents quand tout est vide** —
    seul le président voit alors un « à renseigner » vers Paramètres : un cadre vide en haut de la
    barre dirait qu'il manque quelque chose à quelqu'un qui n'y peut rien. `Parametres.jsx`
    n'écrit que les **clés modifiées**, pour que les autres gardent leur `updated_at`.
- **Numéro de résolution SAISISSABLE** (2026-08-26) : il doit reprendre celui de la **convocation**,
  que l'ordre de saisie ne reproduit pas (on entre souvent dans le désordre, ou on insère après
  coup). `nextResolutionNumero` ne sert plus que de valeur par défaut à la création. L'unicité
  `(ag_id, numero)` est validée **côté écran** avant l'envoi — le message de Postgres serait
  illisible. Les résolutions s'affichent **triées par numéro** (déjà le cas des deux côtés).
  - **ZONE DE GARAGE ≥ 101** (`NUMERO_GARAGE`, `agLogic.js`) : imposer un numéro déjà pris ne bloque
    plus, l'**occupante est déplacée** au premier numéro libre à partir de 101, après confirmation
    qui nomme les deux résolutions. Elle part en fin de liste avec un badge « à renuméroter ».
    Sans ça, renuméroter selon la convocation obligeait à libérer le numéro d'abord — un blocage en
    chaîne pour une simple frappe. `nextResolutionNumero` **ignore la zone de garage**, sinon une
    garée au 101 ferait proposer 102 à la suivante.
    ⚠ Choix retenu **contre l'ÉCHANGE** de numéros : l'échange donne silencieusement à l'occupante
    un numéro d'allure normale mais probablement faux lui aussi ; 101 signale qu'il reste à faire.
  - **SOUS-NUMÉROTATION « 10-1 / 10-2 »** (migration 032) : `sous_numero integer not null
    default 0`, unicité sur `(ag_id, numero, sous_numero)`. Une résolution du PV donne parfois
    **plusieurs lignes** ici — `resolutions_ag.projet_id` étant scalaire et l'enveloppe
    indivisible, ventiler un budget voté sur trois projets impose trois lignes. Sans sous-numéro,
    il fallait inventer des numéros absents du PV : un registre légal ne ment pas sur ça.
    **Deux entiers et non un texte** : « 10-1 » en texte se range avant « 2 ». L'affichage est
    reconstruit par `numeroResolution`, la saisie relue par `parseNumeroResolution` (`agLogic.js`),
    et le tri partagé par les deux backends via `compareResolutions`.
  - ⚠ Le verrou de `updateResolution` (décision ou projet rattaché) empêche de **renuméroter** une
    résolution déjà engagée — et donc aussi de la garer : dans ce cas l'écran refuse et demande un
    autre numéro. Numéroter juste dès la saisie.
- **Pièces jointes sur l'AG elle-même** (migration 031) : `assemblees_generales.documents`, avec une
  **`categorie`** (`convocation` / `pv` / `autre`) rangée dans le jsonb — aucune contrainte, donc
  aucune migration pour une 4e catégorie. La convocation et le PV ne se rattachent à AUCUNE
  résolution : la première prouve la régularité de l'appel, le second couvre la séance entière.
  Chemin `ag/<id>/…` — **aucune policy de Storage à ajouter** : `documents_insert_membre` n'exclut
  que les décisions enregistrées, et `documents_brouillon_prive` ne vise que le préfixe `decisions`.
  ⚠ **Reste possible sur une AG CLÔTURÉE**, et c'est voulu : le PV arrive après la clôture — même
  exception que le rattachement des enveloppes. `pv_url` (lien externe hérité) n'est pas supprimée.
- **Pièces jointes : bucket privé `documents`** (migration 012). La ligne ne garde que
  `{path,name,type,size}` ; le fichier vit dans le Storage. Plafond **25 Mo/fichier** en prod
  (`MAX_DOC_BYTES` dans `config.js` **et** `file_size_limit` du bucket — les deux ensemble).
  - **On stocke un CHEMIN, jamais une URL** : le bucket est privé, donc aucune adresse
    permanente n'existe. `repo.getDocumentUrl(doc)` signe une URL de 5 min au clic.
  - **Convention de chemin PORTEUSE** : `decisions/<decision_id>/<uuid>.<ext>` (idem
    `projets/`). L'id est dans le chemin pour que les policies puissent relire la ligne, donc
    refuser de toucher au fichier d'une décision **enregistrée**. Ne pas la changer sans
    relire la migration 012.
  - **L'id de l'entité est tiré côté client** (`crypto.randomUUID()` dans `DecisionForm` /
    `ProjetForm`, passé à l'insert) : à la création, le fichier part AVANT que la ligne
    existe. C'est pourquoi la policy d'insert n'exige pas que la décision existe.
  - **Le base64 hérité cohabite, définitivement** : `getDocumentUrl` sert `doc.dataUrl` tel
    quel s'il est présent. Pas de migration des anciennes PJ — celles qui pendent à une
    décision enregistrée ne peuvent pas être déplacées sans modifier une délibération figée.
  - **Orphelins assumés** : « Retirer » dans un formulaire n'efface **pas** l'objet du bucket
    (annuler ensuite laisserait la ligne avec un chemin mort). Quelques Mo perdus sur 1 Go
    valent mieux qu'un devis introuvable dans un registre légal.
  - **Le mode démo n'a pas de bucket** : le mock garde le base64 en localStorage, plafond
    2 Mo — quota navigateur, pas une règle du produit. Il ne peut donc rien prouver sur les
    chemins ni sur les policies.
- Premier login (prod) : les non-admins sont bloqués par `<ForcePasswordChange>` tant que
  `user_metadata.password_changed !== true`. Min 8 caractères.

### Notifications — manuelles, choix assumé
Historique : edge function Resend → CallMeBot WhatsApp → fix User-Agent 403 → **tout supprimé**.
État actuel : bouton « Prévenir le CS » → `wa.me/?text=…` sans numéro, l'utilisateur choisit le
groupe CS. Owner-only, bascule en « Notifier à nouveau ».
`date_notification` enregistre que le partage a été **lancé**, pas qu'un message a été **délivré**.

> « Choix assumé : pas d'envoi automatique. Notifier 4 personnes ne justifie ni service d'envoi,
> ni domaine à vérifier, ni passerelle tierce. » (`src/lib/share.js`)

**RELANCE CIBLÉE** (2026-09-26, écran `RegistreCS`) — un menu liste les membres qui ont **encore
quelque chose à voter**, avec leur compte ; en choisir un filtre la liste sur ses votes en attente
et ouvre un message WhatsApp reprenant toutes ses décisions.
- ⚠ **UN SEUL MESSAGE POUR N DÉCISIONS**, titré par le COMPTE : relancer trois fois de suite pour
  trois décisions, c'est se faire ignorer à la deuxième. « Il me reste trois votes » agit, « une
  décision vous attend » se remet à plus tard.
- ⚠ **`needsMyVote` N'EST PAS RÉUTILISABLE** : il ferme sur `me` et `myVotedSet`. La même question
  posée pour un AUTRE membre a son propre calcul (`enAttenteParMembre`), qui applique la même
  règle — `voteOuvert`, actif **à la `date_publication`** (art. 15 / 026), aucune ligne de vote.
  Un membre élu depuis n'est pas relancé sur une décision ouverte avant lui ; un membre **inactif**
  n'est jamais relancé (sa ligne manquante est un départ, pas un oubli).
- ⚠ **SANS NUMÉRO DE TÉLÉPHONE.** Une colonne `membres_cs.telephone` a été envisagée puis
  **écartée par Pascal en séance** (« on oublie le numéro »). La 003 l'avait posée, la 004
  supprimée avec `whatsapp_apikey` : elle reste supprimée. Le message **nomme la personne**, ce qui
  protège du mauvais destinataire quand WhatsApp s'ouvre sans contact.
- ⚠ **AUCUNE TRACE N'EST ÉCRITE.** `date_notification` dit qu'une décision a été annoncée **au
  conseil** ; un rappel adressé à une seule personne ne l'est pas, et poser cette date ferait croire
  le conseil prévenu.
- **Président et secrétaire seulement** (arbitrage Pascal) : relancer le conseil, c'est le convoquer.
- Choisir un membre **remet `onlyToVote` et le filtre d'état à zéro** : « à voter » porte sur MES
  votes, « état » sur le résultat — laissés en place, ils rendraient une liste vide sans raison
  visible. Le menu d'état est désactivé tant qu'un membre est sélectionné.
- ⚠ **`RelanceModal` n'est PAS `ShareModal`** (DecisionDetail) : l'une porte UNE décision et ses
  gabarits, l'autre UNE PERSONNE et N décisions. Ce qui doit rester identique, ce sont les **gestes**
  — texte éditable, « Copier », app native par `whatsapp://`, WhatsApp Web en secours.

**Ne pas réintroduire de notification automatique sans demande explicite.**

> **Demande explicite reçue (2026-07-20), à faire APRÈS l'AG** : ajouter des **notifications
> automatiques par EMAIL** (4 déclencheurs : décision à voter, réponse Q/R, décision enregistrée,
> signature demandée) **tout en gardant** le bouton manuel `wa.me` pour le groupe. WhatsApp-API
> écarté (n'écrit qu'en 1-à-1, jamais dans un groupe). Bloqueurs : domaine vérifié (financé par le
> budget AG) + réintroduction d'une Edge Function pour l'envoi serveur. Détail et justification :
> `docs/ETAT_COURANT.md` (backlog). Ne concerne QUE l'email — le WhatsApp automatique reste écarté.

---

## Supabase

**Modèle d'identité** : tout est clé sur **`membres_cs.id`**, *pas* `auth.users.id`. Le lien est
l'**email**, qui doit correspondre exactement entre Auth Users et `membres_cs`.

### Registre des propriétaires (migration 035) — ⚠ DONNÉES PERSONNELLES
> **Président et secrétaire UNIQUEMENT**, lecture comme écriture. `lots` et `proprietaires` ne
> figurent **PAS** dans la boucle `read_auth` : c'est l'inverse de tout le reste de l'app, et c'est
> délibéré — un trésorier ou un membre ordinaire ne voit rien, pas même le nombre de lots.
> **Ne pas relâcher sans arbitrage.**

- **`lots.numero` porte la PARCELLE CADASTRALE** (`0B 220`, `0B 247+263`), pas un numéro de lot :
  le lotissement n'en a pas de numérotation utilisable aujourd'hui. La colonne « N° » des fichiers
  de l'ASL est le **numéro de voirie** et leur colonne « lot » un **nombre** de lots (1, sauf 1,81
  et 1,19 — 51 lots pour 50 colotis). La parcelle est le seul identifiant réel, unique et
  vérifiable au cadastre, et c'est déjà elle qui désigne les colotis dans les listes de vote.
  Le cahier des charges de 1955 parle bien de « lot n°13, zone A », mais **aucun document connu ne
  relie cette numérotation d'origine aux parcelles actuelles** — l'inventer serait pire que rien.
  ⚠ **UNE PREMIÈRE CORRESPONDANCE A ÉTÉ RETROUVÉE** (2026-08-28) : le siège de la société LE CLAPOTIS
  est déclaré au registre officiel « LOT 5 DU LOTISSEMENT DE RIVES », et cette société occupe la
  parcelle `0B 203` — donc **lot 5 = 0B 203**. Les titres de propriété que réunit Me Garnier
  devraient porter cette numérotation pour toutes les parcelles ; la demander explicitement.
  La **zone** (A à E) est en observations, faute de colonne dédiée. L'écran dit donc « parcelle »,
  pas « lot ».
- **`lots.numero_syndic`** (migration 039) : la référence de **Foncia**, qui revient dans tous les
  appels de fonds. **Ce n'est pas l'identifiant de la parcelle** — celui-là vient du cadastre
  transmis par la Mairie et vit dans `numero`. **Aucune unicité**, délibérément : c'est une
  référence étrangère tenue par un tiers, le registre la constate et n'arbitre pas la comptabilité
  du syndic. ⚠ Ne jamais s'en servir comme clé dans du code.
- ⚠ **LA PARCELLE 263 EST PARTAGÉE ENTRE DEUX PROPRIÉTAIRES**, à **81 %** et **19 %** — elle a été
  divisée mais est **restée une seule parcelle** au cadastre. D'où deux lignes qui la citent toutes
  les deux (`0B 247+263` et `0B 474+263`) et les `nombre_lots` de **1,81** et **1,19**. Ce n'est
  **pas** un doublon à corriger : « nettoyer » l'un des deux effacerait 19 % d'un lot de l'assiette
  des voix et des charges.
- **`lots.nombre_lots`** (migration 038) — **une parcelle n'est pas un lot** : deux d'entre elles
  pèsent **1,81** et **1,19**, soit **51 lots pour 50 parcelles**. Le total des lots se **somme sur
  cette colonne**, jamais sur le nombre de lignes ; compter les lignes annoncerait 50, un chiffre
  faux dans un registre qui sert d'assiette aux voix et aux charges. `not null default 1` :
  nullable, le total varierait selon qui a pensé à remplir le champ. `numeric(4,2)` — 1,81 n'est
  pas un entier. ⚠ Le tantième reste calculé sur la **superficie**, pas sur `nombre_lots` : le vote
  est au prorata des superficies.
- ⚠ **« M. OU MME X » CHEZ FONCIA VEUT DIRE QUE LES DEUX SONT PROPRIÉTAIRES** — ce n'est pas une
  formule de politesse ni un genre inconnu (arbitrage Pascal, 2026-08-28). Quand l'état du syndic
  porte cette mention et que le registre ne nomme qu'une personne, **c'est le registre qui est
  incomplet**, pas le syndic qui se trompe. Trois comptes ont d'abord été pris pour des mutations
  sur ce malentendu (Pargoux, Van Den Berg, Huergo) : dans les trois cas la seconde personne est la
  **conjointe copropriétaire**. 13 seconds propriétaires ont été ajoutés à ce titre le 2026-08-28.
  ⚠ **Sans cocher `est_indivision`** : un couple marié n'est pas en indivision — c'est exactement la
  distinction que porte la case.
- **DEUX PROPRIÉTAIRES ≠ INDIVISION** (migration 040). `nom_2` / `email_2` / `telephone_2`
  constatent le **FAIT** qu'un bien est détenu par deux personnes ; `est_indivision` porte la
  **QUALIFICATION**, cochée seulement quand on la connaît. Détenir à deux n'est pas être en
  indivision — communauté entre époux, tontine, démembrement. Le registre **constate**, il ne
  qualifie pas à la place du notaire. `not null default false` : non cochée, la case dit « on ne
  l'affirme pas », pas « ce n'en est pas une ». ⚠ Les totaux distinguent les deux : « N à deux
  noms, M en indivision ».
- **DEUX PROPRIÉTAIRES, UNE LIGNE** (migration 038). Une indivision, c'est une part de charges, une voix, une période — deux **lignes**
  compteraient la parcelle, la superficie, les voix et les charges en double, et l'index partiel
  `proprietaires_actuel_par_lot` l'interdit à juste titre. Une indivision compte donc pour **UN**
  propriétaire dans les totaux. ⚠ Limite assumée : **deux** indivisaires nommés, pas trois — le
  registre n'en connaît pas au-delà, un troisième se note en observations.
- **Le LOT est stable, le propriétaire est une PÉRIODE.** `lots` (numéro, adresse dans le
  lotissement) ; `proprietaires` = une ligne par période de propriété. Propriétaire **actuel** =
  `date_cession is null` ; l'historique, ce sont les autres. Une **mutation** clôt la période en
  cours et en ouvre une nouvelle — les deux dates la portent, **pas de table `mutations`**.
- **Index partiel `proprietaires_actuel_par_lot`** : un lot n'a jamais deux propriétaires actuels.
  Sans lui, une mutation mal terminée rendrait le registre faux en silence.
- **`lots.superficie`** (migration 036) est une **ASSIETTE**, pas une donnée descriptive : elle
  porte le **poids de vote en AG** (vote au prorata des superficies) et la **répartition des
  charges**. Une superficie fausse ne produit pas un affichage faux, elle produit un vote faux et un
  appel de fonds faux. `numeric(10,2)` — arrondir déplacerait des voix.
  ⚠ Le **TANTIÈME n'est PAS stocké** : il se dérive de la somme des superficies, comme le budget
  d'un projet se dérive de ses résolutions. Le dénominateur est le total des superficies
  **renseignées** — tant que le registre est incomplet les parts sont provisoires, et l'écran le
  dit. `assemblees_generales.m2_presents` reste **saisi** : c'est un constat de séance, pas un calcul.
- **« DIRIGEANT », PAS « GÉRANT »** (migration 042, correction Pascal 2026-08-28). **Gérant est une
  FONCTION, pas une catégorie** : une SCI a des *dirigeants*, dont l'un peut être gérant, un autre
  président, un autre associé — et c'est le champ `dirigeant_fonction` qui le dit. Nommer la colonne
  `gerant_nom` puis y ranger un président écrivait dans un registre légal une qualité que
  l'intéressé n'a pas. Colonnes renommées (`dirigeant_nom`, `_fonction`, `_email`, `_telephone`,
  `adresse_dirigeant`, et les mêmes en `_2`) plutôt qu'un simple changement de libellé : une base
  qui dit « gérant » sous un écran qui dit « dirigeant » finit toujours par ressortir dans un export.
- ⚠ **LES SOCIÉTÉS SE VÉRIFIENT AU REGISTRE OFFICIEL** (`recherche-entreprises.api.gouv.fr`,
  données INSEE / RNE), qui **prime sur nos listes de vote comme sur l'état du syndic**. La
  vérification du 2026-08-28 a montré que **six des douze SCI ne portent pas « SCI » dans leur nom**
  (Logudoro, Le Clapotis, Entre Lac et Montagnes, Kitka, Maison du Lac, Precettes) — nous l'avions
  ajouté à l'import — et que **trois dirigeants étaient faux** : le gérant de Logudoro est Laurent
  et non Marc Pais, celui de Kitka est Isabelle Kittler et non Nicolas Kah, et l'« associée » de
  Precettes avait été prise pour une mandataire. ⚠ Elle a aussi montré que **deux « erreurs » du
  syndic n'en étaient pas** : GABISAM est une SCI réellement créée le 2026-05-11 (mutation que
  NOTRE registre ignorait) et JEANLU est le nom d'une société dont Chappuis Olivier est dirigeant.
  **Vérifier avant d'accuser le syndic.**
- ⚠ **`dirigeant_fonction` RECOPIE LE REGISTRE OFFICIEL** (annuaire des entreprises, gouv.fr) —
  **« autre » y compris**. Ce n'est pas un champ mal rempli à nettoyer : c'est la qualité telle que
  l'État l'enregistre, et deux dirigeants de la SCI Ravoire la portent réellement. La « corriger »
  en devinant « gérant » ou « président » substituerait notre hypothèse à une source officielle,
  dans un registre légal. **Ne pas y toucher sans pièce à l'appui.**
- **CO-DIRECTION : deux dirigeants nommables** (`dirigeant_nom_2` / `_fonction_2` / `_email_2` /
  `_telephone_2`, migration 041). C'est le cas ordinaire d'une SCI familiale, et il a des effets
  concrets : **l'un comme l'autre engage la société**, donc vote et signe pour elle. N'en nommer
  qu'un laissait le registre muet sur celui qui se présenterait à l'AG. ⚠ **Pas de seconde
  adresse** : `adresse_dirigeant` reste unique, c'est en pratique le siège. Limite assumée, la même
  que pour les indivisaires : **deux** nommés, le troisième en observations.
- **LE MANDATAIRE N'EST PAS UN DIRIGEANT** (migration 037, correction Pascal 2026-08-27). Le
  **dirigeant** est un organe de la société propriétaire : il n'existe que si le propriétaire EST une
  société, et il l'engage. Le **mandataire** est l'intermédiaire à qui l'on parle quand on n'atteint
  pas le propriétaire — cas courant des colotis étrangers. Il peut exister sur une **personne
  physique**, et une SCI peut avoir ses dirigeants à l'étranger ET un mandataire sur place. D'où
  `mandataire_nom` / `_email` / `_telephone` **distincts** des `dirigeant_*`, et un bloc affiché pour
  **tout** propriétaire, pas seulement les sociétés. Les fondre écrirait dans un registre légal que
  l'intermédiaire dirige la société. ⚠ Le mandataire suit le PROPRIÉTAIRE, pas le lot : il ne
  s'hérite jamais à la mutation.
- **DESTINATAIRES OFFICIELS : PLUSIEURS, et des SOURCES, pas des copies** (`contacts_officiels`,
  `text[]`, migrations 043 puis 044). ⚠ **On convoque tous ceux qui doivent l'être**, pas un seul :
  les deux indivisaires, l'usufruitier **et** le nu-propriétaire d'une donation démembrée, le
  dirigeant d'une SCI **et** son mandataire sur place. La 043 posait un choix unique — contresens
  corrigé par la 044. Quatre cases : propriétaire, second propriétaire, dirigeants (les **deux**
  sont rendus), mandataire. La colonne ne stocke que les **cases cochées**, jamais l'adresse. Recopier produirait deux faux : une correction chez le
  mandataire n'atteindrait pas la convocation, et changer de source écraserait l'adresse propre du
  propriétaire. Dérivé à la lecture par `contactOfficiel()` (`src/lib/proprietaireLogic.js`), comme
  le tantième ou le budget d'un projet. ⚠ **Aucune retombée** sur une autre source quand la désignée
  est vide : afficher l'adresse du propriétaire alors qu'on a désigné le mandataire ferait croire à
  un envoi possible — l'écran affiche « injoignable ». Une source cochée **mais vide** n'est pas un
  destinataire. ⚠ **Au moins une case** : un ensemble vide voudrait dire « ne convoquer personne ».
  `email` / `telephone` restent la propriété du PROPRIÉTAIRE et ne sont écrits que par lui.
- **Mention RGPD acceptée une fois par personne** (`membres_cs.registre_rgpd_accepte_le`, tracée par
  `trg_membres_audit_rgpd`). L'écran d'acceptation s'affiche **à la place** du registre, jamais
  par-dessus. Texte dans `src/lib/rgpdRegistre.js`, partagé par l'écran et le rappel permanent —
  **ne pas l'adoucir sans arbitrage** : il dit ce qui est communicable (nom, adresse dans le
  lotissement, lot) et que toute autre divulgation engage la responsabilité personnelle.
- **EXPORT POUR LE NOTAIRE** (2026-09-26, `downloadRegistreNotairePDF` + `colotisNotaireToCSV`) :
  la liste des parcelles, propriétaires et **adresses électroniques**, avec deux colonnes VIDES
  — « Acte reçu le », « Observations » — que Me Garnier remplit et retourne (résolution n° 15 de
  l'AG 2026, chaque coloti doit lui adresser son titre avant le 31 octobre).
  - ⚠ **LES ADRESSES ÉLECTRONIQUES SORTENT DU REGISTRE PAR EXCEPTION**, sur **arbitrage exprès de
    Pascal** : « chaque coloti va lui envoyer son acte de vente donc tu peux mettre les emails dans
    ce fichier », et « c'est un notaire, pas un quidam ». La mention RGPD interdit de communiquer
    *sans arbitrage* — elle n'interdit pas d'arbitrer. **Le destinataire fait partie de la
    décision** : officier public tenu au secret, mandaté par l'AG. La même liste à un coloti, au
    syndic ou à un prestataire serait une divulgation. **Ne pas étendre sans un nouvel arbitrage.**
  - **Restent exclus** : adresses de communication (domiciles hors lotissement) et téléphones.
  - Les adresses sont les **CONTACTS OFFICIELS** (044), pas la colonne `email` : dirigeant de SCI et
    mandataire compris. `email` seul aurait privé le notaire de l'interlocuteur réel de la moitié
    des sociétés.
  - ⚠ **L'export porte sur TOUT le registre, jamais sur la recherche en cours** : un « état des
    colotis » amputé serait lu comme exhaustif, et les parcelles absentes passeraient pour n'avoir
    rien à transmettre. Seul l'ORDRE d'affichage est repris.
  - **Les parcelles vacantes y figurent**, en rouge et nommées « propriétaire inconnu » : le notaire
    doit savoir à qui il ne peut rien réclamer.
  - ⚠ **Les colonnes à remplir sont VIDES** : l'application ne sait pas qui a transmis son acte,
    c'est le notaire qui le sait. Rien n'est pré-coché.
  - ⚠ **PDF en PAYSAGE**, avec des constantes de page LOCALES : les constantes du module décrivent
    une page portrait, utilisée par le registre des décisions — les modifier aurait déplacé celui-ci.
  - ⚠ **Pas `num()` de `ui.jsx`** dans les cellules : `Intl` fr-FR insère une espace fine U+202F,
    le caractère qui a donné « 20/000,00 » (cf. `pdfText`), et **les cellules d'`autoTable` ne
    passent pas par `text()`**. D'où un formateur local qui applique la correction à la source.
- ⚠ Ce registre **EST le rôle des colotis** dont dépendait le chantier d'onboarding gelé
  (`docs/SPEC_ONBOARDING_COLOTIS.md`). Il est conçu pour pouvoir servir d'ancre d'identité (e-mail
  normalisé comme `membres_cs`) mais **n'ouvre RIEN** : aucun compte, aucune lecture élargie.
- Le mock reproduit la garde de rôle pour que la démo montre le même refus — il ne **prouve** rien,
  seules les policies ferment. À éprouver sur staging.

### Envois aux colotis (migration 056) — un HISTORIQUE, pas un outil d'envoi
> Les messages collectifs partent d'un **AppleScript**, depuis Mail, sur le Mac de Pascal, et son
> journal est **écrasé à chaque campagne**. Convoquer, relancer, informer sont des actes de gestion :
> le registre garde qui a été destinataire, quel texte exact, à quelle date.

- ⚠ **L'APPLICATION N'ENVOIE RIEN** (phase 1). `scripts/importer_envois.mjs` lit le dossier d'envoi
  après chaque campagne et inscrit la dernière. La phase 2 fera partir les messages d'ici — d'ici là,
  promettre un bouton d'envoi serait un mensonge d'interface. **`canal` est la SEULE colonne qui
  connaisse l'outil** (`applescript_mail` / `app`), pour que la bascule n'impose aucune migration.
- ⚠ **IL NE RECONSTITUE QUE LA DERNIÈRE CAMPAGNE** : le journal est réécrit à chaque exécution.
  À lancer **après chaque envoi**. Les antérieures ne survivent que dans `_OLD/`. Accepté.
- ⚠ **DEUX TABLES POUR DEUX DROITS D'ACCÈS**, pas par goût de la normalisation. `communications`
  suit `sujet_entrees` (**lue par tous** : un acte de gestion, et le texte a été adressé à 55
  personnes) ; `communication_destinataires` suit `proprietaires` (**président et secrétaire
  seuls** : ce sont exactement les adresses que la 035 a fermées, les rouvrir ici les ferait fuir
  par la porte de derrière). Les fondre en un seul jsonb aurait rendu ce partage impossible.
  - ⚠ **La spécification demandait les deux à la fois** — « lecture pour tout membre authentifié »
    *et* « même régime que `proprietaires` », qui sont opposés. Tranché par la **nature de la
    donnée**. Écart assumé, à confirmer avec Pascal.
  - ⚠ **Côté Supabase, la RLS ne renvoie pas d'erreur** à un non-bureau : le select rend zéro ligne.
    `getCommunication` tranche sur `nb_destinataires` (porté par la campagne, lisible par tous) et
    renvoie `destinataires: null` — **« vous n'avez pas à les voir », pas « envoyé à personne »**.
    Confondre les deux ferait dire à l'écran qu'un message n'est parti à personne.
- **`RgpdGate` a un mode `compact`** (dans une carte, sans en-tête de page) et un libellé `quoi`.
  L'**acceptation est commune** à tous les écrans qu'il protège : ce sont les mêmes adresses, donc la
  même obligation. La redemander écran par écran transformerait une mention qu'on lit en une case
  qu'on clique.
- **Rien n'est modifiable depuis l'app, sauf `commentaire`** : ce sont des faits survenus, pas des
  brouillons. Corriger le texte d'un message déjà parti réécrirait l'histoire.
- ⚠ **`proprietaire_id` nullable, et c'est un SIGNALEMENT** : une adresse sans correspondance est
  soit un contact périmé — le prochain envoi manquera la même personne — soit quelqu'un qui n'est
  pas coloti. Le script **ne crée jamais** de propriétaire à cette occasion, et l'écran affiche
  « hors registre ».
- ⚠ **L'entrée grisée « Messages aux propriétaires » a été RETIRÉE du menu** (et le rendu « à venir »
  avec elle) : à côté d'« Envois aux colotis », deux entrées aux noms voisins dont une morte
  désorientent au lieu de guider.

#### Campagnes reconstituées (migration 058) — dire ce qu'on sait, et **comment**
- ⚠ **TOUTES LES CAMPAGNES NE SE VALENT PAS.** Celle du 25/09 est adossée à un journal qui nomme
  chaque destinataire et son sort ; les trois antérieures ont été **retrouvées après coup** (journal
  écrasé), leur date et leur liste établies par recoupement. Les inscrire à l'identique ferait du
  registre un menteur poli : tout y aurait l'air également certain.
  - `communications.fiabilite` = `journal` | `reconstitue` (défaut `journal` — vrai de l'existant).
  - `communication_destinataires.statut` gagne **`suppose_envoye`**. ⚠ Ce n'est **pas** un `envoye`
    dégradé : la personne **figurait sur la liste**, aucun envoi vers elle n'a été constaté. La
    différence compte le jour où quelqu'un affirme n'avoir rien reçu.
  - **`nb_envoyes = 0` sur une reconstituée**, et l'écran affiche un **tiret**, pas un zéro : « 0
    envoyés » sur 50 destinataires se lirait comme un échec total. Mettre 50 affirmerait 50 remises
    vérifiées.
  - Le `certitude` du manifeste finit dans `commentaire` et **s'affiche dans le bandeau** : c'est le
    seul endroit qui dise à partir de quoi la date et la liste ont été établies.
- **Mode reprise** : `importer_envois.mjs --campagnes "<_campagnes>"`, un sous-dossier par campagne
  (`manifeste.json` + textes + liste, ou `message.eml`, ou un journal). Un journal présent **fait
  foi** et rend la campagne `journal`.
- ⚠ **LE `.eml` DU 18/08 PORTE AUSSI UN `To` DE 14 ADRESSES**, disjointes des 36 du `Bcc`. La spec
  ne parlait que du `Bcc` : s'y tenir aurait **effacé 14 destinataires réels** sans que rien ne le
  signale. On lit `To` + `Cc` + `Bcc`, dédoublonnés → **50 uniques** (le manifeste en annonçait
  « 59 environ »). Les comptes par en-tête figurent au rapport.
- ⚠ **Le `.eml` est lu par PYTHON** (`scripts/lire_eml.py`) : en-têtes repliés, noms en RFC 2047,
  corps multipart en quoted-printable. Un parseur maison rend du charabia — ou pire, du texte
  partiel qui a l'air correct. Même raisonnement que `lire_pdf.swift`.
- ⚠ **LE FILET BILINGUE N'EST PAS LE MÊME PARTOUT** : le script écrit 60 tirets, le message du 18/08
  — écrit à la main — sépare par `————`. `couperBilingue` coupe sur toute ligne de traits ; coder
  celui du script aurait rangé tout l'anglais du 18/08 dans le corps français.
- ⚠ **Les noms sont conservés TELS QUELS, mojibake comprise.** « M. Mme Hartwig Jean-Fran√ßois » est
  correctement encodé dans le message : la corruption est dans la **fiche de contact au moment de
  l'envoi**. La réparer ici écrirait autre chose que ce qui est parti, et masquerait une fiche à
  corriger.
- ⚠ **Tout canal doit avoir son libellé** dans `CANAL_LABELS` : sans lui, l'écran affiche la valeur
  brute de la base (« mail_bcc ») au milieu de libellés français. Constaté, puis corrigé.

### Archives des PV depuis 1955 (migration 057) — un FONDS, pas des assemblées
> Un voisin a conservé **tous les procès-verbaux depuis 1955**. L'application les conserve et les
> rend cherchables, pour que la mémoire du lotissement ne dépende plus d'un carton chez un
> particulier.

- ⚠ **ON NE CRÉE AUCUNE LIGNE `assemblees_generales`.** Cette table porte un cycle de vie, des
  résolutions, des votes, des m² et des comptes : y verser soixante-dix ans d'assemblées fantômes
  ferait apparaître des AG sans résolution ni quorum dans les écrans de gestion, et fausserait les
  budgets consolidés. `pv_archives.assemblee_id` est un lien **facultatif**, pour les AG qui
  existent dans l'app — même raisonnement que `mandats_cs.ag_id` (051).
- ⚠ **`annee` obligatoire, `date_ag` facultative** : sur un document de 1957 le jour est souvent
  illisible. Exiger la date complète obligerait à **inventer un jour**. Contrainte
  `pv_archives_annee_coherente` : une date complète doit tomber dans son année de classement.
- ⚠ **`texte_ocr` SERT À CHERCHER, JAMAIS À CITER**, et l'écran le dit **au-dessus** du texte, pas
  en note de bas de page. Une recherche sans résultat ne prouve rien : c'est un constat, pas une
  conclusion. **Le scan fait foi.**
- ⚠ **OCR : ni `tesseract`, ni `ocrmypdf`, ni `pdftotext`, ni Homebrew sur ce Mac** — vérifié.
  `scripts/lire_pdf.swift` utilise **PDFKit + Vision**, livrés avec macOS : couche texte du PDF
  d'abord (résultat EXACT), reconnaissance française ensuite. Éprouvé sur un scan dactylographié de
  1961 et sur le cahier des charges de 1955 (19 pages). **Un seul appel pour tous les fichiers** :
  `swift x.swift` recompile à chaque exécution.
  - `qualite = bonne` est **réservé au PDF qui portait déjà son texte** ; tout ce qui sort d'une
    reconnaissance est au mieux `moyenne`.
  - **L'OCR n'est jamais bloquant** : un document illisible entre au fonds sans texte. Une archive
    qu'on ne peut pas chercher vaut mieux qu'une archive qui n'existe pas.
- ⚠ **ÉCART ASSUMÉ : colonne GÉNÉRÉE `recherche` au lieu de l'index d'expression de la spec.**
  PostgREST ne sait interroger que des **colonnes** — un index sur `to_tsvector(...)` aurait imposé
  une RPC dédiée, ou serait resté inutilisé. `textSearch(..., { type: 'websearch' })` accepte ce
  qu'un humain tape sans lever sur une syntaxe invalide.
- **Idempotence par EMPREINTE du fichier** (SHA-256 dans `document`, index unique) : ni le nom (qui
  se renomme) ni la date (deux PV par an). Les doublons **dans un même lot** sont écartés avant
  l'insert — sinon l'unique ferait échouer l'import au milieu, la moitié des fichiers déposés.
- ⚠ **`--hors-ligne`** éprouve la convention de nommage **sans base** : renommer soixante-dix
  fichiers après coup coûte plus cher que de vérifier sur les cinq premiers.
- ⚠ **Pas de `\b` autour des sigles** dans la lecture des noms (`pvArchiveLogic.js`) : le trait bas
  est un caractère de mot, donc `\bAGO\b` ne trouve rien dans `2016-09-03_AGO.pdf` — c'est-à-dire
  dans la convention elle-même. Défaut trouvé **en éprouvant** la fonction, pas en la relisant.
- **La frise des années manquantes est le cœur de l'écran**, pas une décoration : une archive qui
  montre seulement ce qu'elle contient laisse croire qu'elle est complète.
- ⚠ **AUCUNE ENTRÉE DE MENU** (arbitrage Pascal, 2026-09-25 — elle y a figuré une journée). Le fonds
  se rejoint par un **bouton en tête de l'écran Assemblées Générales** : on ne cherche pas le PV de
  1978 en parcourant un menu, on le cherche en pensant aux assemblées. En entrée distincte, il
  devenait un second registre concurrent du premier.
  - ⚠ Les routes sont donc **`/ag/archives`** et `/ag/archives/:id`, et pas seulement par élégance :
    c'est cette URL qui garde l'entrée « Assemblées Générales » **active** dans la barre de gauche
    pendant la consultation. Avec `/archives-pv`, aucune entrée ne s'allumait — on ne savait plus où
    l'on était. `/ag/archives` n'est pas capturé par `/ag/:id` : react-router classe par
    **spécificité**, un segment littéral l'emportant sur un segment dynamique.
  - ⚠ **Le manuel suit** : les trois actions des archives sont rattachées à l'entrée « Assemblées
    Générales » d'`aideLogic.js`, pas à une section propre — le manuel est organisé par entrée de
    menu, lui en donner une décrirait un menu qui n'existe pas.
- **Lue par tous** (comme la mémoire, 045), **écrite par le bureau**. Ce n'est pas le registre des
  propriétaires : un PV nomme des personnes, mais il a été adressé en son temps à tous les colotis.
- ⚠ **`Input` enveloppe TOUJOURS son champ dans un `<label>`** : une classe `flex-1` passée à
  `Input` atterrit sur le champ, pas sur l'enfant flex. `Textarea` a été corrigé de ce piège (rendu
  nu sans `label`), **`Input` non** — envelopper l'appel dans un `div` porteur du `flex-1`.

Tables : `membres_cs`, `mandats_cs`, `parametres`, `assemblees_generales`, `resolutions_ag`, `projets`,
`decisions`, `votes`, `questions_reponses`, `signature_batches`, `decision_status_history`,
`decisions_historique`, `cron_runs`, `lots`, `proprietaires`, `comptes_ag`, `audit_log`,
`communications`, `communication_destinataires`, `pv_archives`.

Helpers (`security definer`, `search_path = public`) :
- `is_admin()` → email JWT = membre `role='president'` et `actif`
- `current_membre_id()` → `membres_cs.id` pour l'email du JWT

RLS :
- `read_auth` — SELECT **true** pour tout authentifié, sur **toutes** les tables (tout membre
  connecté lit tout).
- `write_admin` — `for all using (is_admin())` partout **sauf** `votes` / `questions_reponses`.
- `decisions_owner_insert` / `decisions_owner_update` — owner seul, et
  **`with check (… enregistree = false)`**, clause **porteuse** : c'est elle qui réserve l'acte
  au président et empêche un owner de se dessaisir en changeant `created_by`. Les policies
  permissives s'additionnent (OR) → le président garde tout via `write_admin`.
- `votes_self_write` — un membre ne gère **que son vote**, et **seulement si
  `decision.enregistree = false`**.
- `qa_self_insert` — `auteur_id = current_membre_id()`.

**Migrations** : `NNN_snake_case_description.sql`, 3 chiffres. **Appliquées à la main dans le SQL
Editor Supabase** — pas de CLI, pas de `config.toml`, pas d'Edge Functions. Chaque migration est
commentée avec le *pourquoi*. **`schema.sql` est maintenu à jour** pour qu'une install neuve
n'ait besoin d'aucune migration → toute migration doit être répercutée dans `schema.sql`.

Région : **eu-west-3 (Paris)**. 003 a ajouté `telephone`/`whatsapp_apikey`, **004 les supprime**
(piste CallMeBot abandonnée) — ne pas les ressusciter.

**026 est la première migration à installer un PLANIFICATEUR** (`pg_cron`, tâche horaire
`ouvrir-decisions-planifiees`). L'activation de l'extension est *best-effort* : si le SQL Editor
n'a pas les droits, la migration émet un **NOTICE** au lieu d'échouer, et seul le filet applicatif
reste. **Le lire** — sinon on croit le cron en place. Vérification :
`select * from cron.job where jobname = 'ouvrir-decisions-planifiees';`
Elle ajoute aussi deux tables en **lecture seule côté client** (`decisions_historique`,
`cron_runs`) : aucune policy d'écriture, elles ne sont alimentées que par des fonctions
`security definer`.

---

## Conventions

**Répartition des langues — la convention structurante :**
- **UI : français**, toujours, avec apostrophes typographiques `’` et tirets cadratins `—`.
- **Identifiants et colonnes DB : français** (`membres_cs`, `date_limite_reponse`, `enregistree`,
  `montant_engage`, `quorum_atteint`).
- **Commentaires : français** pour tout ce qui est métier/juridique et tout ce qui est récent.
  L'anglais subsiste dans l'infra ancienne (`config.js`, `api.js`, `pdf.js`, `ui.jsx`). La
  tendance est nettement au français → **écrire les nouveaux commentaires en français**.
- Variables locales : anglais (`loading`, `busy`, `filtered`, `selected`).

**Style de commentaire — le signal le plus fort du repo.** Les commentaires expliquent le
*pourquoi*, citent les statuts, et consignent les alternatives rejetées. Bloc d'en-tête par
fichier. **Reproduire cette densité** : ici un commentaire qui dit pourquoi une règle a été
écartée vaut plus que dix qui décrivent le code.

- **Fichiers** : composants/pages `PascalCase.jsx` ; lib `camelCase.js`. Export default par
  page/composant ; exports nommés depuis `lib`.
- **State** : `useState`/`useMemo` locaux uniquement. **Pas de Redux, Zustand ni React Query.**
  Un seul contexte : `AuthContext`. Chaque page a son `reload()` qui `Promise.all` les appels
  repo puis `setLoading(false)`.
- **Idiome de résilience** : les chargements secondaires font `.catch(() => [])` — une requête
  qui échoue ne doit jamais vider l'écran.
- **Accès données** : les pages importent `{ repo }` depuis `lib/api` et **ne touchent jamais un
  backend directement**. Toute nouvelle méthode repo doit être ajoutée **aux deux**
  (`mockDb.js` *et* `supabaseDb.js`) avec des signatures identiques.
- ⚠ **Le mock est plus permissif que Supabase — il masque des bugs de prod.** `updateX` fait un
  `Object.assign` et avale n'importe quelle clé ; PostgREST, lui, **rejette toute colonne
  inconnue**. Un `getX` qui renvoie une jointure (ex. `getAG` → `resolutions`) ne doit jamais
  voir cet objet repartir tel quel dans un `update` : construire un payload explicite limité aux
  colonnes réelles. Une modif « qui marche en mock » n'est pas vérifiée.
- **Styling** : utilitaires Tailwind inline ; palette `navy-*` (`#1F3864`, choisie pour coller au
  registre Word existant). ⚠ `cx()` n'est **pas exporté** par `ui.jsx` : composer les classes
  conditionnelles avec un template literal. Ton : sobre, professionnel,
  document juridique.
- **MÉMOIRE DU LOTISSEMENT** (`sujets` + `sujet_entrees`, migration 045). Un « sujet » n'est ni
  un projet (budget, dates, chef) ni une décision (délibération) : c'est le fil d'un dossier qui
  traverse les années — le portail, la zone C, le recouvrement — et il porte le **POURQUOI**, que
  rien d'autre ne conserve. ⚠ **DEUX tables pour deux questions** : « où en est-on ? » (une
  synthèse réécrite, `sujets.contenu`) et « comment y est-on arrivé ? » (une chronologie qui
  s'ajoute, `sujet_entrees`). Un seul texte perdrait l'attribution et la date des faits.
  - **`titre` UNIQUE** : deux sujets « Portail » scinderaient la connaissance en deux moitiés dont
    aucune ne serait complète — le mode de ruine d'une base de connaissance.
  - **`date_evenement` modifiable**, `created_at` jamais : même règle que `journal_projet`.
  - **`categorie` LIBRE**, sans contrainte — une catégorie imprévue ne doit pas exiger une
    migration (même choix qu'en 031).
  - **Lue par TOUS les membres** (boucle `read_auth`). ⚠ C'est l'inverse du registre des
    propriétaires, et c'est voulu : celui-ci porte des données personnelles de tiers, celle-là est
    la mémoire commune du conseil — la cacher recréerait le problème qu'elle résout.
  - **La synthèse est collective** (tout membre actif l'améliore), les **entrées appartiennent à
    leur auteur**. ⚠ **Supprimer un sujet est réservé au président** : effacer une mémoire que
    d'autres ont nourrie n'est pas une correction.
  - **PIÈCES JOINTES** (migration 046) sur les **entrées** de chronologie et sur le **sujet**
    lui-même. Une entrée qui dit « refus de la mairie » vaut cent fois moins que la même
    accompagnée du courrier. ⚠ Le chemin porte l'id du **SUJET**, pas de l'entrée : le sujet
    existe toujours au moment de l'envoi, l'entrée pas encore. **Aucune policy de Storage à
    ajouter** — vérifié : `documents_insert_membre` ouvre à tout membre actif,
    `documents_brouillon_prive` ne vise que le préfixe `decisions`.
  - **REPRENDRE UNE PIÈCE DÉJÀ DANS LE DOSSIER** (`disponibles` de `PiecesJointes`, 2026-09-21).
    ⚠ Question de Pascal : « comment je fais pour sélectionner un document déjà en base ? ». On ne
    pouvait pas — le composant n'avait qu'un envoi de fichier, donc mettre le même document sur deux
    entrées obligeait à le **retéléverser**, créant deux objets identiques dans le bucket.
    Le sélecteur ajoute une **nouvelle référence au MÊME `path`** (id neuf) : le fichier n'existe
    qu'une fois, il est cité deux fois. ⚠ Retirer l'une ne touche pas l'autre — « Retirer » n'efface
    jamais l'objet du Storage, et c'est ce qui rend le partage sûr.
    ⚠ Dédoublonné sur le **chemin**, pas le nom : deux noms identiques peuvent désigner deux fichiers.
  - **CE QUI RESTE À COMPLÉTER** (`elementsACompleter`, écran Mémoire, 2026-09-21) : un bandeau
    compte les manques, un bouton les déplie, chacun avec **la phrase qui dit ce qui manque**.
    ⚠ Né de l'import du 2026-09-21, qui a introduit 13 entrées sans date connue : **une chronologie
    fausse à un endroit ne se voit pas en la lisant** — elle se range au mauvais moment et paraît
    normale. Sans liste qui les rassemble, ces dates restent.
  - ⚠ **DATE SENTINELLE `1999-09-09` = « date inconnue »** (`DATE_INCONNUE`, `sujetLogic.js`).
    `date_evenement` est `not null` et la chronologie se trie dessus : il n'existe aucun autre moyen
    d'exprimer « je ne sais pas ». Choisie **absurde** pour ne jamais être lue comme une vraie date.
    ⚠ Elle est **dupliquée dans `scripts/data/memoire_asl_*.mjs`** — modifier l'une oblige à
    modifier l'autre. ⚠ Elle ne s'affiche **jamais comme une date** : badge « Date à renseigner »
    dans la chronologie, et elle est **exclue de la période couverte** (sinon un dossier de 2019 à
    2026 s'annonçait « 09/09/1999 → … », un repère faux qui a l'air d'un fait).
  - ⚠ **Ne signaler QUE ce qu'on peut nommer** : un sujet sans pièce jointe n'est pas incomplet. Le
    bruit tue la liste — leçon des fausses alertes « injoignable » de l'export.
  - ⚠ **Limite assumée, v1** : aucun lien formel vers les décisions et les projets. On cite les
    numéros dans le texte. Une table de liaison s'ajoutera si l'usage la réclame.
- **MANUEL organisé par ENTRÉE DE MENU** (`src/lib/aideLogic.js` + `pages/Aide.jsx`), contenu
  **versionné avec le code**, jamais en base — une aide stockée dériverait du produit sans que
  rien ne le signale.
  - ⚠ **Par MENU et non par rôle** (arbitrage Pascal, 2026-09-03) : on n'ouvre pas un manuel en
    se demandant « que puis-je en tant que trésorier ? », mais « je suis sur cet écran, comment
    je fais telle chose ? ». **Le rôle ne sert plus qu'à FILTRER** — on ne voit que les menus et
    les actions réellement ouverts, et chaque action se déplie en **pas-à-pas**.
  - `visiblePar` de chaque menu **reproduit le filtrage de `Layout.jsx`** : le manuel ne doit
    jamais décrire un écran que le lecteur ne voit pas. ⚠ Modifier l'un oblige à modifier l'autre.
  - ⚠ **PAS de liste grisée des actions interdites** (arbitrage Pascal) : une colonne de titres
    barrés encombre sans rien expliquer. Chaque écran porte une **`noteAcces` rédigée**, affichée
    seulement à qui y est bridé — « cet écran est en lecture seule pour vous ; seul le président… ».
  - ⚠ **On ne cache JAMAIS un écran qu'on peut lire** : un menu sans aucune action ouverte reste au
    manuel, avec sa note. Ce sont les **boutons d'écriture** que l'app retire, pas l'écran — et
    elle le fait déjà (`canManage` dans `AGList`, `AGDetail`, `Membres` ; `canEdit` dans
    `ProjetDetail`).
  - **PARCOURS transversaux** (`PARCOURS`), sur leur **propre écran** « Comment faire »
    (`pages/CommentFaire.jsx`, entrée de menu distincte). ⚠ Deux questions différentes : le manuel
    répond à « je suis sur cet écran, que puis-je y faire ? », les parcours à « je dois accomplir
    telle chose, par où je commence ? ». Affecter un budget va de l'AG au projet, mener une
    décision va du brouillon à la signature — aucune entrée de menu ne pouvait les porter, et les
    enfouir dans le manuel les rendait introuvables. **Les deux pages se renvoient l'une à
    l'autre.**
  - ⚠ **Ne décrire que ce qui est VRAI** : un manuel qui promet un bouton inexistant est pire que
    pas de manuel. Deux pièges vérifiés dans le code avant rédaction — le **trésorier a un pouvoir
    réel** (sans son vote ou celui du président, une décision qui engage de l'argent n'est pas
    adoptée), et **« chef de projet » n'est PAS un rôle du bureau** mais une désignation sur un
    projet. ⚠ Dire aussi ce qu'on **ne peut pas** faire : la moitié des questions d'un nouveau
    membre porte sur une limite prise pour une panne.
- **Mobile** : `useIsMobile()` (<768px) → mobile = **consultation + vote seulement**. Création et
  gestion derrière `!isMobile` et `<DesktopOnly>`.
  - ⚠ **LA GARDE ANTI-DÉBORDEMENT D'`index.css` CACHE LES PANNES QU'ELLE NE RÉPARE PAS**
    (2026-09-21, signalé par Pascal sur la mémoire du lotissement). `overflow-x: hidden/clip` sur
    `html`/`body`/`#root` empêche la page de défiler latéralement — donc **coupe** ce qui dépasse,
    sans barre de défilement et **sans rien qui signale qu'il manque du texte**. Un écran amputé a
    l'air normal : c'est le pire mode de panne pour un registre.
  - **Cause unique des trois écrans coupés** (mémoire, tableau de bord, fiche projet) : un enfant
    de grille garde `min-width: auto`, donc la piste est dimensionnée sur sa largeur de **contenu
    minimal** (un nom de fichier, un montant, un badge insécable) — 476, 630 et 720 px dans une
    colonne de 343. Réglé en un point : `:where(.grid) > * { min-width: 0 }` dans `index.css`.
    ⚠ `:where()` annule la spécificité, donc un `min-w-*` explicite l'emporte toujours.
  - **UN TABLEAU LARGE DEVIENT DES CARTES, il ne défile pas** (`isMobile ? cartes : table`) :
    `RegistreCS`, `Membres`, `ProprietairesList`, puis `ProjetList`, `AGList` et
    `BudgetsConsolidated` (2026-09-21). Le `.overflow-x-auto` **fonctionne** — mais rien n'indique
    qu'il y a quelque chose à droite, et ce sont les colonnes de MONTANTS qui tombent : sur
    Budgets, « Voté », « Projets », « Engagé direct » et « Restant » étaient tous hors cadre.
  - ⚠ **Les montants `fr-FR` ne se coupent JAMAIS en deux lignes** : le séparateur de milliers est
    une espace insécable. Un `text-2xl` déborde de sa carte en portrait (148 px pour 132) → `text-lg
    sm:text-*` sur les chiffres des cartes de synthèse.
  - **Comment vérifier** : le navigateur piloté fige son viewport ; charger l'app dans une
    **iframe** de 390 px donne au document interne son vrai viewport (media queries et `matchMedia`
    s'y résolvent). Mesurer l'amputation, et **ignorer ce qui a un ancêtre en `overflow-x: auto`** —
    sinon tout le contenu d'un tableau qui défile remonte en faux positif.

---

## Variables d'environnement

Toutes préfixées `VITE_`. **`process.env` n'est jamais utilisé** — uniquement `import.meta.env`,
et **uniquement dans `src/lib/config.js`**. Aucun autre fichier de `src/` ne lit l'env : passer
par `config.js`. `.env*` est git-ignored sauf `.env.example`.

| Var | Rôle |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet. Présence + anon key ⇒ `BACKEND='supabase'`, sinon `'mock'` |
| `VITE_SUPABASE_ANON_KEY` | Clé anon publique (sûre côté client, la RLS protège) |
| `VITE_SIGNATURE_PROVIDER` | `'mock'` (défaut) ou `'yousign'` |
| `VITE_TEST_VOTES` | `'true'` ouvre le mode test (le président pose le vote de tout membre). **Fermé par défaut** — le laisser fermé. |
| `VITE_YOUSIGN_API_KEY` | Documentée dans `.env.example`, **lue nulle part** (morte) |
| `VITE_YOUSIGN_BASE_URL` | Idem, **morte** |

Le switch mock/supabase est décidé **une fois au chargement du module**, pas réactivement.

---

## Déploiement

`vercel.json` ne contient qu'une réécriture SPA (`/(.*)` → `/index.html`) ; Vercel auto-détecte
Vite. **Déploiement automatique au push sur `main`** (repo privé `happypascal/CS_Rives` →
`cs-rives.vercel.app`). `.gitattributes` force LF (`* text=auto eol=lf`) pour le build Linux —
attention sous Windows. `dist/` est git-ignored.

Une migration DB n'est **pas** déployée par le push : l'appliquer à la main dans le SQL Editor.
Un push qui suppose une migration non appliquée casse la prod.

Procédure complète : `docs/DEPLOIEMENT.md`.

---

## État actuel

**Arbre propre sur `main`. Zéro TODO/FIXME. Zéro `console.*` dans `src/`.** Repo inhabituellement
soigné — le garder ainsi.

**Fonctionne** : CRUD complet décisions/AG/résolutions/projets/membres ; vote self-only avec
projection live ; quorum + adoption art. 15 ; enregistrement avec snapshot + verrou ; fils Q/R ;
export PDF (unitaire + registre complet avec sommaire) ; budgets consolidés + CSV Foncia ; audit
log ; parcours de vote mobile ; changement de mot de passe forcé ; reset ; double backend
mock ⇄ Supabase à parité d'interface.

**Inachevé / stubs** :
0. **Mise en page du PDF du registre à refaire entièrement** (jugement Pascal, 2026-07-16 : « ne va
   pas du tout »). Exemple du rendu actuel à la racine du repo : `registre-CS-2026 (2).pdf` (non
   versionné). Le *contenu* est validé — la table des matières porte le bon résumé
   (`decisionResume`) ; c'est la **forme** qui est à reprendre, dans `src/lib/pdf.js`.
1. **Signature électronique : mock uniquement.** `yousignProvider` throw à chaque appel. Les
   lots, la sélection de signataires et un bouton « Simuler signé (démo) » existent ; aucun
   câblage Yousign réel, aucune Edge Function. Les `VITE_YOUSIGN_*` sont mortes.
2. **Représentation (art. 15 « ou représentés »)** — non implémentée, documentée comme telle.
3. `resolutions_ag.majorite_requise` accepte `'absolue'` ; aucune logique ne différencie les
   majorités (les résultats d'AG sont saisis, pas calculés).

**Piège de coordination** : les messages de commit référencent un fichier **`SPECS`** (§4.3, §4.5,
§5) qui **n'existe ni dans le repo ni dans l'historique git**. Il vit hors versioning. Ne pas
inventer son contenu ; le demander s'il devient nécessaire.

`docs/GUIDE_A_comptes_membres.md` contient en dur la ref du projet Supabase live
(`aitqnonioyhurbystfnk`).
