# Guide B — Emails automatiques « nouvelle décision à voter »

Objectif : à chaque nouvelle décision, chaque membre reçoit un email avec un
lien pour voter. Tout est prêt côté code (fonction `notify-decision`). Il reste
à brancher un **service d'envoi d'emails** (Resend) et un **déclencheur**.

⏱️ Compter ~20-30 min. Si tu bloques à une étape, envoie-moi une capture / le
message d'erreur.

---

## Partie 1 — Créer un compte Resend

1. Va sur **https://resend.com** → **Sign up** (tu peux utiliser Google ou GitHub, ou un email + mot de passe).
2. Valide ton email si demandé.
3. Tu arrives sur le tableau de bord Resend.

## Partie 2 — Choisir l'expéditeur (2 cas)

Resend doit savoir **depuis quelle adresse** envoyer. Deux options :

### Option 2A — Pour commencer / tester (aucun domaine requis)
- Resend fournit un expéditeur de test : `onboarding@resend.dev`.
- ⚠️ Limite : il n'envoie **qu'à ta propre adresse** (celle de ton compte Resend).
- Parfait pour **vérifier que le mécanisme marche**, avant d'ouvrir aux 4 membres.
- Dans ce cas, tu n'as **rien à configurer** ici. `FROM_EMAIL` restera `onboarding@resend.dev`.

### Option 2B — Pour envoyer aux 4 membres (domaine vérifié)
Pour écrire aux vraies adresses des membres, il faut un **domaine** (ex. `atta-norm.ch`) :
1. Resend → **Domains** → **Add Domain** → saisis ton domaine.
2. Resend affiche **3-4 enregistrements DNS** (type TXT/MX/CNAME).
3. Ajoute ces enregistrements chez ton **hébergeur de domaine** (là où le domaine est géré).
4. Reviens sur Resend → **Verify** (la vérification peut prendre quelques minutes à quelques heures).
5. Une fois vérifié, ton `FROM_EMAIL` sera du type `CS Rives <cs@atta-norm.ch>`.

> 👉 Dis-moi ton domaine et ton hébergeur quand tu y es, je te dis exactement quels enregistrements ajouter.

## Partie 3 — Récupérer la clé API Resend

1. Resend → **API Keys** → **Create API Key**.
2. Nom : `cs-rives` · Permission : **Sending access** → **Add**.
3. **Copie la clé** (`re_...`) et garde-la (elle ne se réaffiche plus). ⚠️ Ne me l'envoie pas ici.

## Partie 4 — Déployer la fonction dans Supabase

Le code est dans le repo : `supabase/functions/notify-decision/index.ts`.

### Option 4A — Via le Dashboard (sans rien installer)
1. Supabase → menu **Edge Functions** :
   **https://supabase.com/dashboard/project/aitqnonioyhurbystfnk/functions**
2. Clique **« Deploy a new function »** (ou **« Create a new function »**).
3. Nomme-la **exactement** `notify-decision`.
4. Colle **tout** le contenu de `index.ts` dans l'éditeur.
5. Clique **Deploy**.

### Option 4B — Via le CLI (si l'option A n'est pas dispo)
```bash
npm i -g supabase
supabase login
supabase link --project-ref aitqnonioyhurbystfnk
supabase functions deploy notify-decision
```

## Partie 5 — Renseigner les secrets de la fonction

1. Edge Functions → clique **`notify-decision`** → onglet **Secrets** (ou **Settings**).
2. Ajoute :
   - **`RESEND_API_KEY`** = ta clé Resend (`re_...`)
   - **`FROM_EMAIL`** = `onboarding@resend.dev` (option 2A) **ou** `CS Rives <cs@ton-domaine>` (option 2B)
   - **`APP_URL`** = `https://cs-rives.vercel.app`
3. Enregistre.

## Partie 6 — Créer le déclencheur (Database Webhook)

1. Supabase → **Database** → **Webhooks** :
   **https://supabase.com/dashboard/project/aitqnonioyhurbystfnk/database/hooks**
2. Clique **« Create a new hook »**.
3. Renseigne :
   - **Name** : `notif-nouvelle-decision`
   - **Table** : `decisions`
   - **Events** : coche **Insert** uniquement
   - **Type of hook** : **Supabase Edge Functions**
   - **Edge Function** : choisis **`notify-decision`**
   - Method : POST (par défaut)
4. Clique **Create**.

## Partie 7 — Tester

1. Ouvre l'app → crée une **nouvelle décision**.
2. Vérifie la réception de l'email « Nouvelle décision à voter ».
   - Option 2A : l'email arrive sur **ton** adresse (celle du compte Resend).
   - Option 2B : chaque membre actif reçoit l'email.
3. Diagnostic si rien n'arrive : Supabase → Edge Functions → `notify-decision` →
   **Logs** (tu y verras les erreurs éventuelles). Envoie-les moi au besoin.

---

## Récap des valeurs

| Secret | Valeur |
|---|---|
| `RESEND_API_KEY` | `re_...` (Partie 3) |
| `FROM_EMAIL` | `onboarding@resend.dev` ou `CS Rives <cs@ton-domaine>` |
| `APP_URL` | `https://cs-rives.vercel.app` |

Webhook : table `decisions`, événement `Insert`, cible fonction `notify-decision`.
