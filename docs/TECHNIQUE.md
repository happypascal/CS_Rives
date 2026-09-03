# Documentation technique — par où commencer

> **À qui s'adresse ce document** : un développeur qui reprend le projet, ou un membre du CS qui
> veut faire corriger un défaut. Il ne redit pas ce qui est écrit ailleurs — il dit **où** chaque
> chose est écrite, et **dans quel ordre** la lire.
>
> Le manuel de l'utilisateur, lui, est **dans l'application** (menu « Manuel d'utilisation »).

---

## En trois minutes

Registre légal des délibérations du Conseil Syndical de l'**ASL du Lotissement de Rives**, Nernier
(74140). Base juridique : ordonnance n° 2004-632. La loi impose que les délibérations soient
inscrites sur un registre spécial et signées — **cette application est cette obligation**.

Ce n'est **pas** un outil de gestion parmi d'autres : une régression a des conséquences
juridiques réelles. De vrais membres votent sur de vraies décisions.

| | |
|---|---|
| **Front** | React 19, Vite 8, Tailwind v4, react-router v7. **JavaScript uniquement — pas de TypeScript** |
| **Back** | Supabase : Postgres + Auth + RLS. Aucun code serveur, aucune Edge Function |
| **Hébergement** | Vercel, déploiement automatique au push sur `main` |
| **Qualité** | `npm run lint` (oxlint), lancé à la main. **Aucun test, aucun CI** |

```bash
npm install
npm run dev      # sans .env : backend « mock », données locales, aucun compte requis
npm run lint
npm run build
```

**Sans fichier `.env`, l'application démarre sur un backend factice** (`src/lib/mockDb.js`) avec un
jeu de démonstration. C'est le moyen le plus rapide de voir l'app tourner. Pour viser la vraie base,
créer un `.env` d'après `.env.example`.

---

## L'ordre de lecture

1. **`CLAUDE.md`**, à la racine. **C'est le document le plus important du dépôt.** Il porte la
   doctrine : les règles métier, les arbitrages rendus, et surtout les **alternatives écartées avec
   leur raison**. Le lire en entier avant de toucher au code fait gagner des jours.
2. **`docs/ETAT_COURANT.md`** — le journal de bord, séance par séance. Ce qui a été fait, ce qui
   reste, et pourquoi certaines choses n'ont volontairement pas été faites.
3. **`supabase/schema.sql`** — le schéma complet, commenté. Source de vérité pour une installation
   neuve.
4. **`docs/DEPLOIEMENT.md`** et **`docs/TRANSFERT_ASL.md`** au moment de toucher à l'infrastructure.

---

## La règle qui gouverne tout : l'article 15

> « Ses décisions sont prises à la majorité des membres présents ou représentés. […] En cas de
> partage des voix, celle du président est prépondérante. Les délibérations sont inscrites […] sur
> un registre spécial […] et signé par tous les membres présents à la délibération. »

Encodée dans **`src/lib/decisionLogic.js`** (`tally`). ⚠ **Avant toute modification du vote, de
l'adoption ou de la signature, relire l'article lui-même** — pas ce fichier, pas le README, pas un
commentaire. L'historique montre des règles convenues un jour et invalidées le lendemain.

Points qu'on croit comprendre et qu'on comprend mal :

- **Présent = a voté.** « Absent » n'est pas un choix, c'est l'absence de ligne de vote.
- **L'abstention reste au dénominateur** : `pour * 2 > présents`, avec
  `présents = pour + contre + abstention`. S'abstenir fait obstacle à l'adoption.
- **Le quorum (> 50 % des membres actifs) est une règle INTERNE**, plus stricte que les statuts, qui
  n'en imposent aucun. Ne pas la présenter comme statutaire.
- **La représentation n'est pas implémentée**, volontairement et en connaissance de cause.

---

## Les cinq idées d'architecture

Les comprendre évite de « réparer » ce qui n'est pas cassé.

### 1. Dérivé plutôt que stocké

Le budget d'un projet, son statut, le tantième d'une parcelle, le contact officiel d'un
propriétaire : **rien de tout cela n'est en base**. Tout se recalcule à la lecture.

Stocker créerait une divergence dès qu'une donnée source change — et personne ne remarquerait que
les chiffres sont devenus faux. `projets.statut` a d'ailleurs été **supprimée** (migration 011)
pour cette raison.

### 2. Deux backends à parité stricte

`src/lib/mockDb.js` (localStorage) et `src/lib/supabaseDb.js` exposent **la même interface**.
`src/lib/api.js` choisit l'un ou l'autre au chargement du module.

⚠ **Le mock est plus permissif que Supabase et masque des bugs de production.** Son `updateX` fait
un `Object.assign` et avale n'importe quelle clé ; PostgREST rejette toute colonne inconnue. Une
modification « qui marche en mock » n'est pas vérifiée. Toute nouvelle méthode doit être écrite
**des deux côtés**, avec la même signature.

### 3. La sécurité est en base, pas dans l'écran

Les gardes de l'interface sont un **confort** ; ce qui ferme réellement, ce sont les **policies RLS**.
Modifier un droit dans une page sans toucher à la policy ne protège rien.

Trois principes à connaître :

- `read_auth` — SELECT `true` pour tout authentifié, sur presque toutes les tables. **Deux
  exceptions** : `lots` et `proprietaires`, réservées au président et au secrétaire (données
  personnelles de tiers).
- **Les policies permissives se cumulent en OU.** Fermer un SELECT n'empêche donc ni l'UPDATE ni le
  DELETE d'une ligne ciblée par son id. C'est pourquoi la confidentialité des brouillons exige
  **trois** policies restrictives, une par verbe.
- `is_admin()` teste que l'e-mail du JWT correspond à un membre `role='president'` et `actif`.
  **L'administration suit le mandat, pas la personne.**

### 4. L'identité tient à l'e-mail

Tout est clé sur `membres_cs.id`, **pas** sur `auth.users.id`. Le lien entre les deux est
**l'adresse e-mail**, qui doit correspondre exactement. Une différence de casse a déjà cassé
l'appariement en production — d'où les triggers de normalisation.

### 5. Le verrou de l'acte

`decisions.enregistree = true` ferme définitivement une délibération : ni édition, ni vote, ni
suppression. La clause `with check (… enregistree = false)` des policies d'owner est **porteuse** :
c'est elle qui réserve l'acte au président.

⚠ Attention aux effets de bord hors RLS : une action de clé étrangère échappe aux policies de la
table enfant. C'est pourquoi supprimer un projet devait être bloqué par un **trigger**
(`projets_delete_guard`) et pas seulement par une policy.

---

## Migrations

`supabase/migrations/NNN_description.sql`, **appliquées à la main dans le SQL Editor de Supabase**.
Pas de CLI, pas de `config.toml`.

- Chaque migration est commentée avec **le pourquoi**, pas seulement le quoi.
- **`schema.sql` doit être répercuté** à chaque fois : une installation neuve ne doit avoir besoin
  d'aucune migration.
- ⚠ **Un push qui suppose une migration non appliquée casse la production.** L'ordre est toujours :
  migration d'abord, push ensuite.

**L'éditeur SQL de Supabase est capricieux.** Après plusieurs échecs en série, les règles retenues :
pas de chaîne vide, pas d'argument de formatage dans un `raise`, pas de guillemets dollar imbriqués,
pas de deux-points ni de barre oblique dans une chaîne, une vérification **simple** en fin de script,
et des blocs courts plutôt qu'un long.

⚠ **Un `update … from (values …) join lots on numero` ne remonte AUCUNE erreur** quand un numéro ne
correspond plus : il écrit simplement une ligne de moins, en silence. Compter les lignes écrites
après coup est le seul filet.

---

## Conventions

- **UI, colonnes et commentaires métier : en français.** Apostrophes typographiques `’`, tirets
  cadratins `—`. Variables locales en anglais.
- **Les commentaires expliquent le POURQUOI** et consignent les alternatives rejetées. C'est le
  signal le plus fort du dépôt : ici, un commentaire qui dit pourquoi une piste a été écartée vaut
  plus que dix qui décrivent le code.
- **État local uniquement** : `useState` / `useMemo`. Pas de Redux, Zustand ni React Query. Un seul
  contexte, `AuthContext`.
- **Résilience** : les chargements secondaires font `.catch(() => [])` — une requête qui échoue ne
  doit jamais vider l'écran.
- ⚠ **`cx()` n'est pas exporté** par `ui.jsx` : composer les classes conditionnelles avec un
  gabarit de chaîne.
- **Mobile** = consultation et vote seulement. La saisie est derrière `!isMobile`.

---

## Les pièges qui ont déjà coûté

Chacun a été rencontré pour de vrai. Ils sont détaillés dans `CLAUDE.md`.

| Piège | Ce qui se passe |
|---|---|
| Numérotation des décisions | Attribuée **à la soumission**, jamais à la création : un brouillon abandonné ne doit pas trouer le registre. Le cron d'ouverture traite les décisions **une par une** — un update de masse leur donnerait le même numéro |
| `phase` ≠ `statut` | `phase` = où en est la décision, `statut` = résultat de la délibération. **Ne jamais fusionner** : budgets, CSV et PDF lisent `statut` |
| Une parcelle n'est pas un lot | 51 lots pour 50 parcelles (deux valent 1,81 et 1,19). Compter les lignes donne un chiffre faux, dans un registre qui sert d'assiette aux voix et aux charges |
| Gel du texte | La recette du hash existe **en double**, en SQL et en JS. Modifier l'une oblige à modifier l'autre |
| Filtrage des menus | Répliqué dans `Layout.jsx` et `src/lib/aideLogic.js`. Modifier l'un oblige à modifier l'autre |

---

## Ce qui n'est pas fait, et pourquoi

- **Signature électronique** : le module est un *mock*, `yousignProvider` lève une exception à
  chaque appel. Les `VITE_YOUSIGN_*` sont mortes.
- **Notifications automatiques** : supprimées après trois tentatives (Resend, CallMeBot). Le bouton
  « Prévenir le CS » ouvre un message WhatsApp — l'envoi reste manuel et volontaire.
  ⚠ **Demande explicite reçue** de rétablir des notifications **par e-mail**, après l'AG. Bloqueurs :
  un domaine authentifié et une fonction serveur.
- **Mise en page du PDF du registre** : le contenu est validé, la forme est à refaire
  (`src/lib/pdf.js`).
- **Accès des colotis** : chantier gelé, spécification écrite (`docs/SPEC_ONBOARDING_COLOTIS.md`).
  L'obstacle central est que `read_auth` ouvre la lecture à tout compte authentifié.
- **Aucune sauvegarde automatique** de la base tant que le plan Supabase est gratuit.
  `scripts/backup.mjs` fait un export manuel.

---

## Faire corriger un défaut sans être développeur

Un membre du conseil peut faire évoluer l'application sans savoir programmer, en travaillant avec
un assistant :

1. **Décrire le problème par l'usage**, pas par la solution : « quand je fais ceci, il se passe
   cela, alors que j'attendais autre chose ». Ne pas proposer de correctif — la cause est souvent
   ailleurs qu'on ne croit.
2. **Donner l'écran et le rôle** : ce qui est possible dépend fortement des deux.
3. **Exiger la lecture de `CLAUDE.md` d'abord.** Beaucoup de comportements surprenants sont des
   choix documentés, et « corriger » l'un d'eux casse une règle statutaire.
4. **Ne jamais appliquer une migration sans la lire.** Chacune explique son pourquoi ; si
   l'explication ne convainc pas, ne pas l'exécuter.
5. **Vérifier le résultat en base**, pas seulement à l'écran : le mode démo ne prouve rien sur les
   droits réels.
6. **Après un changement de données, se demander ce qui en dépend.** Une mutation de propriétaire
   change les destinataires des convocations ; un renommage de parcelle casse les rapprochements
   par numéro.

⚠ Trois choses ne doivent jamais entrer dans ce dépôt : les **secrets** (ils vivent dans Supabase et
Vercel), les **données personnelles des colotis** (elles restent dans le dossier de travail de
l'ASL), et une **migration non commentée**.
