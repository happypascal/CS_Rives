# PASSATION — Registre des décisions du Conseil Syndical (ASL Rives)

> Document de reprise. Objectif : permettre à **un autre membre du Conseil Syndical**, aidé de
> **Claude (Claude Code)**, de reprendre entièrement cette application si son auteur (Pascal
> Favre) n'était plus disponible. Il décrit ce que fait l'app, pourquoi, comment elle est
> construite, comment elle tourne, et comment continuer à la faire évoluer.
>
> À jour au 2026-07-18. Écrit en français (langue du projet). Les autres documents cités
> (`SPEC_ROLES.md`, `SPEC_SIGNATURE.md`, `TRANSFERT_ASL.md`, `DEPLOIEMENT.md`, et surtout le
> `CLAUDE.md` à la racine du dépôt) restent la référence de détail — ce document les relie.

---

## 0. Comment utiliser ce document

- **Vous êtes un membre du CS, non technicien** : lisez les parties 1 à 3 (ce que fait l'app et
  ses règles), puis la partie 6 (comment travailler avec Claude) et la partie 7 (accès). Vous
  n'avez pas besoin de coder — Claude le fait ; vous décidez et vous validez.
- **Vous êtes Claude, ou un développeur** : lisez tout. Commencez par le `CLAUDE.md` à la racine
  du dépôt (autoritaire sur le modèle métier), puis ce document pour la vue d'ensemble, puis les
  `SPEC_*.md` pour le détail d'un sujet.
- **Règle d'or** : c'est un **registre légal**. Une régression a des conséquences juridiques
  réelles. En cas de doute sur une règle de vote, de signature ou d'adoption, **relire l'article
  15 des statuts lui-même** (`statuts_ASL_v5_Favre.doc`), jamais un résumé.

---

## 1. Ce qu'est l'application

### Le besoin
L'**ASL — Lotissement de Rives, Nernier (74140)** (Association Syndicale Libre, ordonnance
n°2004-632) est administrée par un **Conseil Syndical (CS)** de 3 à 5 membres élus. La loi et les
statuts imposent que ses **délibérations** soient inscrites sur un **registre spécial** et
**signées**. Cette application **est** ce registre : elle tient les décisions du CS, organise
leur vote électronique, leur enregistrement (l'acte qui les fige), et leur signature.

### Ce qu'elle fait, concrètement
- **Décisions du CS** : tout membre crée une décision, la décrit, y joint des devis. Les membres
  votent à distance (chacun pour lui, depuis son téléphone ou son ordinateur). Le président
  l'**enregistre** une fois le vote clos : elle devient définitive et entre au registre.
- **Assemblées Générales (AG)** : on planifie une AG, on y inscrit des **résolutions** (l'ordre
  du jour), on saisit leur **résultat** après le vote de l'AG (au prorata des superficies, détail
  au PV — l'app ne recompte pas les voix d'AG).
- **Projets** : chantiers du lotissement. Une résolution d'AG **finance** un projet ; les
  décisions du CS **engagent** l'argent contre ce projet.
- **Budgets** : vue consolidée (voté, engagé, restant) exportable en **CSV pour Foncia** (le
  syndic).
- **Signature** : les décisions adoptées et enregistrées sont regroupées et signées
  électroniquement (art. 15) — voir `SPEC_SIGNATURE.md`.
- **PDF** : export du registre complet (avec table des matières) ou d'une décision.

L'application est **en production, avec de vrais utilisateurs** : **https://cs-rives.vercel.app**.

---

## 2. Les utilisateurs et les rôles

Le CS actuel (élus le 2026-01-19) :

| Nom | Rôle | Ce qu'il peut faire en plus d'un membre ordinaire |
|---|---|---|
| **Pascal Favre** | Président | Enregistrer les décisions (l'acte), signer, attribuer les rôles, supprimer, tout gérer |
| **Philippe Bermejo** | Secrétaire | Faire signer les décisions ; créer/modifier les AG et leurs résolutions |
| **Nicolas Maunoir** | Trésorier | Approuver les comptes d'une AGO (avec le président) ; son vote « Pour » compte pour l'adoption d'un engagement |
| **Marc Pais** | Membre | — |
| **Raphaël Serre** | Membre | — |

**Tout membre actif** peut : créer une décision (et la modifier tant qu'elle n'est pas
enregistrée), créer un projet dont il devient le chef, voter pour lui-même, poser des questions.

Le détail complet des capacités par rôle est dans **`SPEC_ROLES.md`** (matrice des droits).

---

## 3. Les règles métier et juridiques — LE CŒUR

> Ces règles sont la raison d'être de l'app. Elles sont encodées dans le code (surtout
> `src/lib/decisionLogic.js`, `agLogic.js`, et les policies RLS de `supabase/schema.sql`). Le
> `CLAUDE.md` du dépôt en est la référence détaillée. Résumé :

### 3.1 La chaîne du domaine
**AG** vote des **résolutions** (avec budget) → une résolution finance un **projet** → le CS prend
des **décisions** qui **engagent** de l'argent contre un projet ou une résolution → **budgets
consolidés** exportés pour Foncia.

### 3.2 Article 15 — le vote et la signature du CS
> « Ses décisions sont prises à la majorité des membres présents ou représentés. En cas de partage
> des voix, celle du président est prépondérante. Les délibérations sont inscrites […] et signées
> par tous les membres présents à la délibération. »

- **Présent = a voté.** Un non-vote est une **absence**, pas une abstention.
- **Vote self-only** : chacun vote pour lui, jamais pour un autre. La **représentation**
  (« ou représentés ») n'est **pas** implémentée — choix assumé : en vote électronique individuel,
  personne ne porte la voix d'un autre.
- **Adoption** = majorité des membres **présents** (`pour × 2 > présents`) ; l'abstention compte
  au dénominateur. **Partage** (`pour × 2 = présents`) → voix prépondérante du président ; s'il n'a
  pas voté, personne ne départage → rejet.
- **Quorum** = plus de 50 % des membres actifs ont voté. ⚠ Règle **interne**, plus stricte que
  l'art. 15 (qui n'impose aucun quorum au CS).
- **Signataires** = tous ceux qui ont voté, **y compris « Contre »**. Un absent ne signe pas.
- **Réserve juridique non levée** : assimiler le vote *à distance et à des moments différents* à
  « membres présents à la délibération » est une interprétation (vraisemblable). À faire confirmer
  au notaire lors d'une validation des statuts. Ne bloque rien.

### 3.3 Enregistrement — l'acte
Le **président seul** enregistre une décision, une fois le quorum atteint. L'enregistrement fige
le statut, le quorum, et un **instantané de la composition** du CS (le PDF reste fidèle même après
un changement de mandat), pose `enregistree = true` → **verrou définitif** : ni édition, ni vote,
ni suppression. Bouton en **haut** de la fiche décision.

### 3.4 Décisions financières — la garde d'engagement (point 3)
Une décision qui **engage un montant** n'est **adoptée** que si, **en plus de la majorité**, **au
moins le trésorier OU le président a voté « Pour »**. Ce n'est **pas** un droit de veto (les deux
n'ont pas à voter pour) — un veto serait contraire à l'art. 15 qui fait décider la majorité. C'est
une garde interne, comme le quorum. Encodée dans `decisionLogic.engagementApprouve` + `tally`.

### 3.5 Budgets
- Seule une résolution **adoptée et dotée** alloue un budget.
- Le budget d'un projet est **dérivé** (somme des résolutions adoptées qui le financent), jamais
  saisi.
- **Allouer ≠ engager.** Une enveloppe rattachée à un projet y passe **en entier**.
- Le statut d'un projet est **dérivé** : `ouvert` tant que rien n'est engagé, `en_cours` dès qu'un
  engagement existe ; suspendre/clôturer/reprendre est une **délibération** du CS (pas une case à
  cocher), effective seulement à l'enregistrement d'une décision adoptée.

### 3.6 Comptes d'une AGO (point 4)
Les comptes de l'exercice liés à une AG **ordinaire** sont **validés** quand le **trésorier ET le
président** ont chacun approuvé (deux approbations distinctes, table `comptes_ag`). Contrôle
interne ; l'approbation légale reste celle de l'AG (quitus).

### 3.7 Signature
Mode **manuel** via **Youtrust** (ex-Yousign), plan gratuit. L'app prépare (PDF + liste des
signataires), le président ou le secrétaire dépose dans Youtrust, puis marque le lot signé.
L'écran ne propose que des **groupes homogènes** (décisions au même ensemble de votants) → un lot
non conforme à l'art. 15 est impossible à composer. **Le module réel Youtrust n'est pas branché**
— c'est encore un *mock*. Détail : `SPEC_SIGNATURE.md`.

---

## 4. Architecture technique

### 4.1 Stack
- **Front** : React 19 (composants fonction + hooks), **Vite 8**, **Tailwind CSS v4** (pas de
  `tailwind.config.js` ; tokens dans `src/index.css`). **JavaScript, pas de TypeScript.**
- **Routing** : react-router-dom v7.
- **Back** : **Supabase** (Auth email/mot de passe + PostgreSQL + Row Level Security + Storage).
- **PDF** : jsPDF + jspdf-autotable (police Assistant embarquée). **CSV** : maison (Foncia).
  **Dates** : date-fns (locale fr).
- **Qualité** : `oxlint` (`npm run lint`). **Aucun test automatisé**, pas de CI. La barrière
  qualité, c'est le lint lancé à la main + la vérification par scripts jetables.

### 4.2 Structure du code (`src/`)
- `App.jsx` : toutes les routes. `main.jsx` : racine.
- `lib/` : la logique.
  - `config.js` : lecture des variables d'env, choix du backend (mock/supabase).
  - `api.js` : façade `repo` + `authApi` — **les pages n'appellent jamais un backend directement**.
  - `mockDb.js` : backend démo (localStorage + données de départ).
  - `supabaseDb.js` : backend Supabase (même interface). `supabase.js` : le client.
  - `AuthContext.jsx` : `useAuth()` → `user`, `isAdmin`, `isSecretaire`, `isTresorier`.
  - `decisionLogic.js` : **pur, testable** — quorum, adoption (art. 15), garde d'engagement.
  - `agLogic.js`, `projetLogic.js`, `rolesLogic.js` : constantes/labels + règles pures.
  - `pdf.js`, `csv.js`, `share.js` (WhatsApp), `signatureProvider.js`, `documents.js` (Storage),
    `format.js` (dates, `eur`, `parseMontant`).
- `pages/` : une par écran (Registre, Décision, AG, Projet, Budgets, Membres, Signatures,
  Paramètres, Login…).
- `components/` : `Layout.jsx` (menu), `ui.jsx` (primitives), `badges.jsx`.

### 4.3 Le double backend — pourquoi c'est central
L'app tourne en **deux modes**, choisis au chargement selon la présence des variables Supabase :
- **`supabase`** (production) : vraie base, RLS active.
- **`mock`** (démo/test) : tout en localStorage du navigateur, avec des données de départ et des
  comptes de test (mot de passe `demo`). Sert à **tester sans toucher la prod**.

⚠ **Le mock est plus permissif que la prod** (pas de RLS) : ce qui marche en démo ne prouve pas les
droits d'accès réels. Toute nouvelle méthode `repo` doit être ajoutée **aux deux** backends avec la
même signature.

### 4.4 Base de données et sécurité (RLS)
- Tables : `membres_cs`, `assemblees_generales`, `resolutions_ag`, `projets`, `decisions`, `votes`,
  `questions_reponses`, `signature_batches`, `comptes_ag`, `decision_status_history`, `audit_log`.
- **Identité** : tout est clé sur `membres_cs.id`, relié au compte Auth par l'**email** (qui doit
  correspondre exactement).
- **RLS** = la vraie protection. Helpers `is_admin()` (président), `is_secretaire()`,
  `is_tresorier()`, `current_membre_id()`. Lecture ouverte à tout membre connecté ; écriture selon
  le rôle. `supabase/schema.sql` est la **source de vérité** (une install neuve n'a besoin que de
  lui).

---

## 5. Fonctionnement en production

### 5.1 Hébergement
- **Front** : Vercel, déploiement **automatique à chaque push sur `main`** →
  **https://cs-rives.vercel.app**.
- **Back** : Supabase, projet **`aitqnonioyhurbystfnk`**, région **Paris (eu-west-3)**.

### 5.2 Déploiement — la règle à connaître
Un `git push` sur `main` déploie le **code** (Vercel, ~1 min). Il **ne déploie pas** les
changements de base de données. Une **migration SQL** s'applique **à la main** dans le SQL Editor
de Supabase. **Code et migration sont deux moitiés d'un même changement** : appliquer la migration
**avant** de pousser le code qui en dépend, sinon la prod casse. (Vécu plusieurs fois.)

### 5.3 Migrations
Dossier `supabase/migrations/`, numérotées (001 → 017 à ce jour). Chacune est commentée avec le
*pourquoi*. **Toutes appliquées.** Prochaine migration libre = **018**. Toute migration doit aussi
être répercutée dans `supabase/schema.sql`.

### 5.4 Comptes et accès
- **Auth** : chaque membre a un compte (Authentication > Users) avec **le même email** que sa fiche
  `membres_cs`. Créer les comptes : voir `docs/GUIDE_A_comptes_membres.md`.
- **Premier accès** : un membre non-président doit changer son mot de passe (min 8 car.).
- **Signature** : compte Youtrust (plan gratuit), utilisé **manuellement**.

### 5.5 La mise en pause Supabase (plan gratuit)
Le projet se met **en pause après 7 jours sans activité**, et le plan gratuit **n'a AUCUNE
sauvegarde automatique**. Un script *keepalive* tourne sur le Mac de Pascal (launchd, toutes les
48 h) pour éviter la pause. ⚠ **C'est fragile** (Mac éteint > 7 j = pause) et **il n'y a pas de
backup**. La vraie solution est **Supabase Pro (~25 $/mois)** : plus de pause + sauvegardes
quotidiennes. C'est l'argument principal du passage en Pro. Voir `TRANSFERT_ASL.md`.

---

## 6. Travailler sur l'application avec Claude

Cette app a été construite en binôme avec **Claude Code**. Pour continuer :

1. **Ouvrir le dépôt avec Claude Code** (le dossier `cs-rives-registre`). Claude lit
   automatiquement le `CLAUDE.md` à la racine du dépôt — **c'est le fichier d'amorçage** :
   il porte le mode de travail, le modèle métier, l'art. 15, les conventions, les pièges.
2. **Décrire ce qu'on veut** en français, comme à un partenaire. Claude propose, code, teste,
   et pousse sur `main` après validation. Un membre du CS **décide et valide** ; il n'a pas à coder.
3. **Le workflow type** : Claude écrit le code + éventuellement une migration SQL → il vous donne la
   migration à coller dans le SQL Editor → **vous l'appliquez** → vous confirmez → Claude pousse le
   code. (Il ne peut pas toucher votre base ni votre Vercel ; c'est vous qui exécutez ces pas.)
4. **Pour tester sans risque** : déployer une copie en **mode démo** (un projet Vercel sur le même
   dépôt, **sans** les variables Supabase → backend mock). Comptes de test, mot de passe `demo`.
   Rien ne touche la prod.

**Conventions à respecter** (détaillées dans le `CLAUDE.md` du dépôt) : UI et identifiants DB en
français ; commentaires qui expliquent le *pourquoi* et citent les statuts ; toute méthode `repo`
ajoutée aux deux backends ; `npm run lint` avant de pousser.

---

## 7. Propriété et transfert des comptes

⚠ **Aujourd'hui, tout repose sur l'identité personnelle de Pascal Favre** : le dépôt GitHub
(`happypascal/CS_Rives`), le compte Vercel, le projet Supabase, le compte admin de l'app. **Si
Pascal disparaît, l'ASL perd l'accès à son propre registre.**

Le plan complet de reprise en main (créer une identité ASL, transférer chaque compte, dans le bon
ordre, sans couper la prod) est dans **`docs/TRANSFERT_ASL.md`**. **C'est la première chose à faire
en cas de passation réelle.** Le point le plus délicat est le transfert Supabase ; le reste est du
confort. Coût cible de l'ensemble : ~31 €/mois.

---

## 8. État actuel et travaux restants

**Fait et en production** (au 2026-07-18) : registre complet des décisions (création, vote,
enregistrement, verrou), AG + résolutions, projets (chef = propriétaire), budgets consolidés + CSV,
PDF (registre + décision, mise en page validée), signature par groupes homogènes (art. 15), rôles
du bureau complets (président/trésorier/secrétaire + les 5 features), notifications WhatsApp
manuelles, mode démo. Données de test **nettoyées** ; la prod contient les 5 vrais membres et
l'AG `AGO-2026-001`.

**Restant / connu** :
- **Signature Youtrust réelle** : encore un *mock*. Le mode manuel est en place ; brancher l'API
  réelle a été **écarté** (1 248 €/an, absurde pour ~40-80 signatures/an). Rester en manuel.
- **Passage en Supabase Pro** (sauvegardes + fin de la pause) et **transfert à l'identité ASL** :
  voir `TRANSFERT_ASL.md`. Fortement recommandé.
- **Représentation** (art. 15 « ou représentés ») : non implémentée, documentée comme telle.
- **Aucun test automatisé** : la logique pure (`decisionLogic`, `agLogic`) mériterait des tests si
  le projet doit vivre longtemps.

---

## 9. Pièges connus (leçons apprises — à ne pas réapprendre à la dure)

- **Tester avant la fin du déploiement Vercel** donne un faux résultat : l'ancien code répond
  encore. Attendre ~1 min ; se donner un repère visible pour distinguer l'ancienne de la nouvelle
  version.
- **Montants** : ne jamais utiliser `<input type="number">` pour un montant — la molette de la
  souris décrémente la valeur (20000 → 19999.99) et le format suisse « 20'000 » est refusé. On
  utilise `type="text"` + `parseMontant` (tolère apostrophe/espace/virgule, arrondit à 2 décimales).
- **SQL Editor Supabase** : deux fonctions `$$` qui se suivent cassent (« unterminated
  dollar-quoted string »). Utiliser des balises **nommées** (`$nom$…$nom$`) et exécuter chaque bloc
  séparément.
- **Ne jamais mélanger SQL et prose** dans un même bloc donné à coller : le SQL Editor prend tout.
- **Un trigger/policy qui lève une exception** affiche « Failed to run sql query » — c'est le
  **succès** du test, pas un échec.
- **Le mock ment par excès de permissivité** : il n'a pas de RLS. Un comportement correct en démo
  peut échouer en prod sur les droits. Toujours vérifier la RLS côté Supabase.
- **Ordre de suppression** : les décisions **avant** les projets (le trigger `projets_delete_guard`
  bloque un projet portant une décision enregistrée). Les décisions enregistrées ne se suppriment
  que par le SQL Editor (qui contourne la RLS), jamais par l'app.
- **Verrou d'enregistrement** : une décision `enregistree` est intouchable par l'app. C'est
  volontaire (registre légal). Ne pas contourner sans raison juridique.

---

## 10. Index des documents et fichiers clés

| Fichier | Contenu |
|---|---|
| `CLAUDE.md` (racine du dépôt) | **Autoritaire** : mode de travail, modèle métier, art. 15, conventions, RLS, pièges. À lire en premier par Claude. |
| `docs/PASSATION.md` | **Ce document** : vue d'ensemble et reprise. |
| `docs/SPEC_ROLES.md` | Rôles du bureau : matrice des droits, les 5 features, migrations 013-017. |
| `docs/SPEC_SIGNATURE.md` | Signature : art. 15, groupes homogènes, quota Youtrust, mode manuel. |
| `docs/TRANSFERT_ASL.md` | **Passation réelle** : transférer les comptes vers une identité ASL. |
| `docs/DEPLOIEMENT.md` | Procédure de déploiement. |
| `docs/GUIDE_A_comptes_membres.md` | Créer les comptes membres dans Supabase. |
| `supabase/schema.sql` | Source de vérité du schéma + RLS (install neuve). |
| `supabase/migrations/` | Historique des migrations (001-017), commentées. |
| `statuts_ASL_v5_Favre.doc` (hors dépôt, à la racine du dossier de travail) | **Les statuts** — l'autorité juridique. Art. 14 (rôles) et 15 (vote/signature). |

**Contact d'origine** : Pascal Favre (pfavre25@gmail.com), Atta-Norm SA. En son absence, ce
document + le `CLAUDE.md` + Claude Code suffisent à reprendre.
