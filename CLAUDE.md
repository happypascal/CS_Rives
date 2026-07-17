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
- **En production, avec de vrais utilisateurs** (`cs-rives.vercel.app`). Une régression a des
  conséquences juridiques réelles, pas seulement des tickets.

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
    ui.jsx            primitives : Button/Card/Badge/Input/Modal/EmptyState/DesktopOnly/Spinner/eur/num/cx
    badges.jsx        badges de statut par entité
    RichTextEditor.jsx  éditeur contentEditable 3 boutons (execCommand)
  pages/              Login, ResetPassword, ForcePasswordChange, Dashboard, RegistreCS,
                      DecisionForm/Detail, AGList/Form/Detail, ProjetList/Form/Detail,
                      BudgetsConsolidated, Membres, Parametres
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
  sans vote est absent, jamais représenté.

### Enregistrement (l'« acte »)
Président seul, quorum atteint, desktop seul. Fige `statut`, `quorum_atteint` et un
`composition_snapshot` du CS (le PDF reste fidèle après un changement de mandat). Pose
`enregistree = true` → **verrou définitif** : ni édition, ni vote, ni suppression. Écrit une
ligne dans `decision_status_history`.

### Modèle de propriété (migration 006)
> Tout membre actif crée et devient owner ; l'owner seul modifie et notifie ; le président
> garde l'acte (enregistrement) et la signature.

Le président conserve tout via `write_admin`. Suppression : président seul, non enregistrée,
et **zéro vote**.

### Autres règles métier figées
- Numérotation décision **`AAAA-NNN`**, next = max+1 de l'année (`nextNumero`).
- `date_limite_reponse` = publication **+ 7 jours ouvrés** (`addBusinessDaysISO`), recalculée
  automatiquement jusqu'à édition manuelle.
- Résolution **verrouillée** dès qu'une décision ou un projet la référence. AG non supprimable
  avec décisions attachées.
- **Projet non supprimable dès qu'une décision ENREGISTRÉE y est rattachée** (règle Pascal : « dès
  qu'on a engagé de l'argent »— l'engagement vient toujours d'une décision enregistrée et adoptée).
  Doublé en base par le trigger `projets_delete_guard` (migration 010) : `decisions.projet_id` étant
  en `on delete set null`, supprimer le projet **modifiait une délibération figée**, en silence et
  hors RLS (une action de FK échappe aux policies de la table enfant). Pas de `on delete restrict` :
  détacher une décision **non** enregistrée reste légitime.
- **Statut projet entièrement DÉRIVÉ** (`computeProjectBudgets`), jamais saisi — `projets.statut`
  a été **supprimée** (migration 011). Deux couches : le statut *naturel* (`ouvert` tant que rien
  n'est engagé, `en_cours` dès que `engage > 0`) ; puis, s'il existe, l'effet de la **dernière
  décision enregistrée ET adoptée** portant un `projet_action` (`suspendre` → `suspendu`,
  `terminer` → `termine`, `reprendre` → rend la main au naturel).
- **Suspendre ou terminer un projet est une délibération du CS** (arbitrage Pascal 2026-07-16) : ni
  le chef de projet ni le président ne le font seuls. Cela se saisit dans `DecisionForm`
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

---

## Supabase

**Modèle d'identité** : tout est clé sur **`membres_cs.id`**, *pas* `auth.users.id`. Le lien est
l'**email**, qui doit correspondre exactement entre Auth Users et `membres_cs`.

Tables : `membres_cs`, `assemblees_generales`, `resolutions_ag`, `projets`, `decisions`, `votes`,
`questions_reponses`, `signature_batches`, `decision_status_history`, `audit_log`.

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
  registre Word existant). Composer via `cx()` de `ui.jsx`. Ton : sobre, professionnel,
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
