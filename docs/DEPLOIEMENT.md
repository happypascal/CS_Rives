# Guide de mise en production — Registre CS Rives

Objectif : passer du mode démo (local) à une vraie app cloud utilisable par le CS,
sur **Supabase** (base + auth) et **Vercel** (hébergement), avec déploiement
automatique depuis le repo GitHub `happypascal/CS_Rives`.

Ce que **tu** dois faire : créer les comptes Supabase et Vercel, cliquer, coller des
clés. Ce que **l'app** fait déjà : tout le reste. Suis les étapes dans l'ordre.

---

## Étape 1 — Créer le projet Supabase

1. Va sur https://supabase.com → *Sign in* (avec GitHub, c'est le plus simple).
2. *New project* :
   - **Name** : `cs-rives-registre`
   - **Database Password** : génère-en un fort et **note-le** (mot de passe de la BDD, différent des mots de passe des membres).
   - **Region** : **West EU (Paris)** — `eu-west-3`.
3. Attends ~2 min que le projet soit prêt.

## Étape 2 — Créer les tables + la sécurité

1. Menu de gauche → **SQL Editor** → *New query*.
2. Copie **tout** le contenu de [`supabase/schema.sql`](../supabase/schema.sql), colle, **Run**.
   → crée toutes les tables, le RLS (sécurité) et les fonctions `is_admin()` / `current_membre_id()`.
3. Nouvelle query : copie [`supabase/seed.sql`](../supabase/seed.sql), **adapte les noms/emails réels**, **Run**.
   → insère les membres du CS (dont **au moins un président**).

## Étape 3 — Créer les comptes de connexion

Les membres se connectent avec **email + mot de passe**. Pas d'auto-inscription : c'est toi qui crées les comptes.

1. Menu → **Authentication** → **Users** → **Add user** → **Send invitation**.
2. Saisis l'email de chaque membre — **exactement le même** que dans `seed.sql`.
   - Fais-le d'abord **pour toi (le président)**.
3. Chaque membre reçoit un email d'invitation, clique, et **choisit son mot de passe** (il arrive sur la page `/reset-password` de l'app).

> **Réglages Auth recommandés** (Authentication → *Providers* / *Settings*) :
> - **Allow new users to sign up** : **OFF** (personne ne s'inscrit seul).
> - Email : le SMTP intégré Supabase suffit pour démarrer (limité, peut arriver en spam).
>   Pour un usage fiable, configure un **SMTP** perso (Authentication → *SMTP Settings*).

## Étape 4 — Récupérer les clés

Menu → **Project Settings** → **API** :
- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** (clé) → `VITE_SUPABASE_ANON_KEY`

(La clé `anon` est **publique**, elle peut apparaître côté client sans danger : c'est le RLS qui protège les données. Ne partage **jamais** la clé `service_role`.)

## Étape 5 — Déployer sur Vercel

1. Va sur https://vercel.com → *Sign in* avec GitHub.
2. **Add New… → Project** → importe le repo **`happypascal/CS_Rives`**.
3. Framework détecté : **Vite** (laisse les réglages par défaut ; `vercel.json` gère les routes SPA).
4. **Environment Variables** — ajoute :
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | (Project URL de l'étape 4) |
   | `VITE_SUPABASE_ANON_KEY` | (clé anon de l'étape 4) |
   | `VITE_SIGNATURE_PROVIDER` | `mock` (pour l'instant) |
5. **Deploy**. Tu obtiens une URL type `https://cs-rives.vercel.app`.

> Chaque `git push` sur `main` redéploie automatiquement.

## Étape 6 — Configurer les URLs de redirection Supabase

Indispensable pour que les liens d'invitation / reset renvoient vers l'app.

Menu Supabase → **Authentication** → **URL Configuration** :
- **Site URL** : `https://TON-APP.vercel.app`
- **Redirect URLs** : ajoute
  - `https://TON-APP.vercel.app/reset-password`
  - `https://TON-APP.vercel.app` (et `http://localhost:5173/*` si tu testes en local)

## Étape 7 — Tester

1. Ouvre l'URL Vercel. L'app **n'affiche plus** « mode démo » (elle est branchée sur Supabase).
2. Connecte-toi en **président** (le compte que tu as invité).
3. Vérifie : créer une décision, voter, enregistrer, gérer un membre.
4. **Mobile** : ouvre l'URL sur ton téléphone → vote depuis la carte « Mon vote », création masquée.
5. **Mot de passe oublié** : teste le lien depuis l'écran de connexion.

---

## Tester en local avant Vercel (optionnel)

```bash
cp .env.example .env.local
# renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev
```

---

## Ce qu'il reste à décider plus tard

- **Domaine perso** (au lieu de `*.vercel.app`) : possible dans Vercel → *Domains*.
- **Signature Yousign réelle** : bascule `VITE_SIGNATURE_PROVIDER=yousign` + Edge Function (la clé API ne doit jamais être côté client). Étape séparée.
- **SMTP perso** pour des emails d'invitation/reset fiables.

---

## Récapitulatif sécurité mots de passe

- Gérés **entièrement par Supabase Auth** : hachés (bcrypt), jamais stockés en clair, jamais visibles par l'app ni par toi.
- Chaque membre **définit lui-même** son mot de passe via l'email d'invitation.
- « Mot de passe oublié » → email → page `/reset-password` → nouveau mot de passe.
- Le RLS garantit qu'un membre ne peut voir/modifier que ce que son rôle autorise.
