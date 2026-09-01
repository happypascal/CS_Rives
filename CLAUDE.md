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
    format.js         wrappers date-fns (fr), todayISO, addBusinessDaysISO
    csv.js            export CSV Foncia (';', décimales ',', BOM UTF-8)
    pdf.js            PDF registre + décision unique, lignes de signature
    share.js          texte WhatsApp + URL wa.me (notification manuelle)
    signatureProvider.js  couche signature : provider mock + stub yousign
    useIsMobile.js    matchMedia <768px
  components/
    Layout.jsx        sidebar, menu mobile, gate ForcePasswordChange, badge démo
    ProtectedRoute.jsx  gate auth + (curieusement) exporte `PageHeader`
    ui.jsx            primitives : Button/Card/Badge/Input/Modal/EmptyState/DesktopOnly/Spinner/eur/num
                      ⚠ `cx` y est PRIVÉ (pas exporté) — composer les classes conditionnelles
                      avec un template literal, ou l'exporter d'abord
    badges.jsx        badges de statut par entité
    RichTextEditor.jsx  éditeur contentEditable 3 boutons (execCommand)
  pages/              Login, ResetPassword, ForcePasswordChange, Dashboard, RegistreCS,
                      DecisionForm/Detail, Signatures, AGList/Form/Detail,
                      ProjetList/Form/Detail, BudgetsConsolidated, Membres, Parametres
supabase/
  schema.sql          schéma + RLS + helpers — source de vérité pour une install neuve
  seed.sql            bootstrap membres_cs
  nettoyage.sql       DESTRUCTIF, ne garde que le président
  migrations/         001..006, voir §Supabase
docs/                 DEPLOIEMENT.md, GUIDE_A_comptes_membres.md, Guide_membre_vote.doc
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
- **Rattachement piloté depuis la fiche AG** (« Ouvrir un projet » / « Rattacher à un projet
  existant »), pas depuis `ProjetForm` — l'AG vote, puis le CS affecte. `resolution_ids` passé à
  `repo.createProjet` est un champ **virtuel** : le repo le retire du payload et pose
  `resolutions_ag.projet_id`. En Supabase c'est **non atomique** (insert + update) : le projet
  est supprimé si le rattachement échoue, pour ne pas laisser de projet à 0 €.
- **Les votes d'AG sont au prorata des superficies et restent dans le PV.** L'app stocke
  **uniquement le résultat**, ne compte jamais de voix d'AG (`agLogic.js`).
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
- **CONTACT OFFICIEL : une SOURCE, pas une copie** (`contact_officiel`, migration 043). L'adresse de
  convocation vient du **propriétaire**, d'un **dirigeant** ou du **mandataire** ; la colonne ne
  stocke que ce **choix**, jamais l'adresse. Recopier produirait deux faux : une correction chez le
  mandataire n'atteindrait pas la convocation, et changer de source écraserait l'adresse propre du
  propriétaire. Dérivé à la lecture par `contactOfficiel()` (`src/lib/proprietaireLogic.js`), comme
  le tantième ou le budget d'un projet. ⚠ **Aucune retombée** sur une autre source quand la désignée
  est vide : afficher l'adresse du propriétaire alors qu'on a désigné le mandataire ferait croire à
  un envoi possible — l'écran affiche « injoignable ». `email` / `telephone` restent la propriété du
  PROPRIÉTAIRE et ne sont écrits que par lui.
- **Mention RGPD acceptée une fois par personne** (`membres_cs.registre_rgpd_accepte_le`, tracée par
  `trg_membres_audit_rgpd`). L'écran d'acceptation s'affiche **à la place** du registre, jamais
  par-dessus. Texte dans `src/lib/rgpdRegistre.js`, partagé par l'écran et le rappel permanent —
  **ne pas l'adoucir sans arbitrage** : il dit ce qui est communicable (nom, adresse dans le
  lotissement, lot) et que toute autre divulgation engage la responsabilité personnelle.
- ⚠ Ce registre **EST le rôle des colotis** dont dépendait le chantier d'onboarding gelé
  (`docs/SPEC_ONBOARDING_COLOTIS.md`). Il est conçu pour pouvoir servir d'ancre d'identité (e-mail
  normalisé comme `membres_cs`) mais **n'ouvre RIEN** : aucun compte, aucune lecture élargie.
- Le mock reproduit la garde de rôle pour que la démo montre le même refus — il ne **prouve** rien,
  seules les policies ferment. À éprouver sur staging.

Tables : `membres_cs`, `assemblees_generales`, `resolutions_ag`, `projets`, `decisions`, `votes`,
`questions_reponses`, `signature_batches`, `decision_status_history`, `decisions_historique`,
`cron_runs`, `lots`, `proprietaires`, `comptes_ag`, `audit_log`.

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
- **Mobile** : `useIsMobile()` (<768px) → mobile = **consultation + vote seulement**. Création et
  gestion derrière `!isMobile` et `<DesktopOnly>`.

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
