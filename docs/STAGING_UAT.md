# Environnement de recette (staging / UAT) — Registre CS Rives

> But : tester l'application **en tant que membre**, sous la **vraie RLS**, sur des
> **données isolées de la production**. Ni le compte admin (qui a tous les droits via
> `write_admin`) ni le backend **mock** (qui n'implémente pas la RLS) ne peuvent
> révéler un bug de permission — d'où ce staging à part.
>
> Coût : **0 €** (2ᵉ projet Supabase en plan Free + déploiements Preview Vercel gratuits).

---

## Architecture

Un **2ᵉ projet Supabase « staging »** (base séparée, RLS réelle) + l'environnement
**Preview** de Vercel branché dessus + une branche Git **`staging`**.

```
main      → Vercel Production → cs-rives.vercel.app          → Supabase PROD
staging   → Vercel Preview    → cs-rives-git-staging-*.app   → Supabase STAGING
```

Le même code tourne des deux côtés ; ce qui change, ce sont les **variables
d'environnement par scope** (Production vs Preview). Le switch `mock ⇄ supabase` se
fait tout seul selon la présence de `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
(cf. `src/lib/config.js`).

---

## ⚠️ Le piège à écarter EN PREMIER (pollution de la prod)

Le déploiement Preview utilise les variables **scope « Preview »** de Vercel. Si les
variables Supabase sont réglées sur **« All Environments »**, alors **le staging tape
dans la base de PROD** — exactement ce qu'on veut éviter.

**Avant tout : Vercel → Settings → Environment Variables → vérifier que les valeurs
prod sont cochées `Production` UNIQUEMENT.** Tant que le projet Supabase staging
n'existe pas, laisser le scope **Preview vide** → l'app tombe en **mock** (isolé,
inoffensif).

**Témoin visuel** (bandeau en haut de l'app, `Layout.jsx`) :
- **« Mode démo (données locales) »** = backend mock (Preview vide) → **sûr**.
- **Pas de bandeau alors que la base staging n'existe pas encore** = tu es sur la
  **prod** → à corriger immédiatement.

---

## Mise en place (une fois)

### A. Projet Supabase staging
1. supabase.com → **New project** : `cs-rives-staging`, région **eu-west-3 (Paris)**,
   plan **Free**. Noter le mot de passe DB.
2. **SQL Editor** → coller **tout** `supabase/schema.sql` → **Run**. (crée tables +
   RLS + bucket `documents` + helpers ; install complète, aucune migration à rejouer)
3. SQL Editor → coller `supabase/seed_staging.sql` → **Run**. (5 membres un par rôle,
   1 AG, 3 résolutions, 1 projet, 2 décisions vivantes à voter)
4. **Authentication → Users → Add user** (5 fois), cocher **Auto Confirm User**, même
   mot de passe (ex. `Staging-2026-Aa`), **emails identiques au seed, en minuscules** :
   `pfavre25+president@gmail.com` · `+tresorier` · `+secretaire` · `+membre1` · `+membre2`
   (les alias Gmail `+` arrivent tous dans la même boîte).
   ⚠️ Une majuscule dans l'email casse `current_membre_id()` → le membre ne peut ni
   voter ni publier (cf. `CLAUDE.md` §identité et le bug prod du 2026-07-19).
5. **Settings → API** → copier le **Project URL** et la clé **anon public**.

### B. Vercel — brancher Preview sur staging
6. Projet `cs-rives` → **Settings → Environment Variables**. Pour `VITE_SUPABASE_URL`
   **et** `VITE_SUPABASE_ANON_KEY` : ajouter une valeur cochée **Preview uniquement** =
   les valeurs du projet staging. **Ne pas toucher** aux valeurs **Production**.
   Résultat : deux valeurs par variable, une par environnement.
   (`VITE_SIGNATURE_PROVIDER` reste `mock`.)

### C. Branche staging
7. La branche `staging` existe déjà (elle suit `main`). Pour la (re)déployer avec les
   nouvelles variables : Vercel → **Deployments** → le déploiement `staging` →
   **Redeploy**.
8. Bookmark l'URL stable **`cs-rives-git-staging-<scope>.vercel.app`** = l'UAT permanent.

---

## Tester (le vrai UAT)
1. Ouvrir l'URL staging (vérifier : **pas** de bandeau « Mode démo » → on est bien sur
   Supabase staging, pas sur le mock).
2. Se connecter en `pfavre25+membre1@gmail.com` :
   - doit pouvoir **voter** la décision `2025-001` et **publier une question** → RLS OK ;
   - ne doit **pas** pouvoir créer/enregistrer une décision → droits membre OK.
3. Refaire en `+tresorier`, `+secretaire`, `+president`. Voter avec **≥ 3 membres** pour
   franchir le quorum (> 50 % des 5 actifs) et observer l'adoption art. 15.

## Repartir sur des données propres (staging uniquement)
`nettoyage.sql` puis `seed_staging.sql` dans le SQL Editor **du projet staging**.
**Jamais** de seed/nettoyage sur la prod.

---

## Flux de promotion qui en découle
`dev → staging (UAT) → merge dans main (prod)`. Corollaire : on teste sur staging, pas
« juste après un déploiement prod » (où l'ancien build répond encore et fausse le test).
