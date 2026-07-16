# Registre des Décisions du Conseil Syndical

Application web pour tenir le registre officiel des décisions du Conseil Syndical de
l'**ASL — Lotissement de Rives, Nernier (74140)** (ordonnance n°2004-632).

Gère : décisions du CS (votes, quorum, Q&A, PDF, signature), Assemblées Générales
(résolutions avec majorités simple / double qualifiée / unanimité, budgets et suivi
d'exécution), vue budgets consolidée avec export CSV pour Foncia, membres du CS.

> **Stack** : React 19 + Vite · Tailwind CSS v4 · Supabase (Auth + PostgreSQL + Storage)
> · jsPDF · react-router. Hébergement cible : Vercel + Supabase (eu-west / Paris).

---

## Démarrage rapide (mode démo — aucun cloud requis)

```bash
npm install
npm run dev
```

Sans variables d'environnement Supabase, l'app tourne en **mode démo** : un backend
local (localStorage) avec des données réalistes préchargées. Comptes de test
(mot de passe : `demo`) :

| Email | Rôle |
|---|---|
| `pfavre25@gmail.com` | Président (admin) |
| `claire.martin@example.fr` | Membre |
| `henri.dubois@example.fr` | Membre |
| `sophie.leroy@example.fr` | Membre |

Les données de démo se réinitialisent depuis **Paramètres → Réinitialiser**.

---

## Passage en production (Supabase)

1. Créer un projet Supabase (région **eu-west / Paris**).
2. Dans le **SQL Editor**, exécuter [`supabase/schema.sql`](supabase/schema.sql)
   (tables, RLS, fonctions `is_admin()` / `current_membre_id()`).
3. Créer les comptes des membres dans **Authentication → Users** avec le **même email**
   que dans la table `membres_cs` (pas d'auto-inscription — spec §4.1).
4. Insérer les membres dans `membres_cs` (un président `role='president'`).
5. Copier `.env.example` → `.env.local` et renseigner :
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
6. `npm run dev` : l'app bascule automatiquement sur Supabase.

Le basculement mock/Supabase est décidé au chargement dans `src/lib/config.js`.

---

## Signature électronique

La couche signature est abstraite (`src/lib/signatureProvider.js`) :

- **`mock`** (défaut) : aucun email réel, permet de simuler le workflow en démo.
- **`yousign`** : à activer via `VITE_SIGNATURE_PROVIDER=yousign`.

> ⚠️ **Sécurité** : la clé API Yousign ne doit **jamais** être exposée côté client.
> En production, l'appel se fait via une **Edge Function Supabase** ; le stub client
> présent ici documente l'interface attendue. Workflow : le président envoie la décision
> **adoptée et enregistrée** ; les signataires sont les membres **présents à la
> délibération**, c'est-à-dire tous ceux ayant voté — y compris « Contre » (art. 15).

---

## Règles métier figées

Source : **ARTICLE 15 des statuts de l'ASL**. En cas de doute, relire l'article — il prime
sur ce README et sur les commentaires du code.

- **Quorum décision CS** : > 50 % des membres actifs ont voté (présent = a voté
  pour/contre/abstention ; « absent » n'est pas un choix, c'est l'absence de vote).
  ⚠ Règle **interne**, volontairement plus stricte : l'art. 15 n'impose aucun quorum au CS.
- **Adoption décision CS** : majorité des membres **présents** (`pour × 2 > présents`).
  Les **abstentions restent au dénominateur** et font donc obstacle à l'adoption.
- **Partage des voix** : `pour × 2 === présents` → la voix du **président est
  prépondérante**. S'il n'a pas voté, personne ne départage → rejetée.
- **Signataires** : tous les membres **présents à la délibération**, y compris ceux ayant
  voté « Contre ».
- **Non couvert** : la représentation (« ou représentés »). Le modèle est self-only ; un
  membre sans vote est absent, jamais représenté.
- **Enregistrement** : fige le statut, le quorum et un **snapshot de la composition** du CS
  (le PDF reste fidèle même après un changement de mandat).
- **Résolutions AG** : `simple` (pour > contre), `double_qualifiee` (2/3 des propriétaires
  ET 2/3 des superficies), `unanimite`.
- **Audit** : `decision_status_history` + `audit_log`.

Logique pure et testable : `src/lib/decisionLogic.js` et `src/lib/agLogic.js`.

---

## Déploiement Vercel

1. Pousser sur GitHub (repo privé `happypascal/CS_Rives`).
2. Importer le repo dans Vercel (framework détecté : Vite).
3. Renseigner les variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   dans **Settings → Environment Variables**.
4. Auto-deploy sur push `main`.

> SPA : `vercel.json` réécrit toutes les routes vers `index.html`.

---

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de dev (HMR) |
| `npm run build` | Build de production (`dist/`) |
| `npm run preview` | Prévisualiser le build |
| `npm run lint` | Oxlint |

## Structure

```
src/
  lib/         config, api (mock+supabase), auth, logique métier, pdf, csv, signature
  components/  UI, layout, badges, éditeur texte riche, route protégée
  pages/       Login, Dashboard, RegistreCS, DecisionForm/Detail,
               AGList/Form/Detail, BudgetsConsolidated, Membres, Parametres
supabase/
  schema.sql   schéma + RLS + fonctions
```
