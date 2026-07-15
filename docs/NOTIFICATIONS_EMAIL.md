# Emails automatiques « nouvelle décision à voter »

Envoie un email à tous les membres actifs dès qu'une décision est créée.
Mécanisme : **Database Webhook** (INSERT sur `decisions`) → **Edge Function**
`notify-decision` → envoi via **Resend**.

Code de la fonction : [`supabase/functions/notify-decision/index.ts`](../supabase/functions/notify-decision/index.ts)

---

## Étape 1 — Compte Resend (envoi d'emails)

1. Crée un compte sur **https://resend.com** (gratuit, 3 000 emails/mois).
2. **Vérifie un expéditeur** :
   - Le plus simple : **API Keys** → crée une clé, et pour l'expéditeur vérifie ton **domaine** (Domains → Add domain) si tu en as un (ex. `atta-norm.ch`).
   - Sans domaine : Resend n'autorise l'envoi qu'à **ta propre adresse vérifiée** (suffisant pour tester, pas pour les 4 membres). Pour la prod, vérifie un domaine.
3. Récupère la **clé API** (`re_...`).

## Étape 2 — Déployer l'Edge Function

**Option A — Dashboard (sans outil) :** Supabase → **Edge Functions** → **Deploy a new function** → nomme-la `notify-decision` → colle le contenu de `index.ts` → Deploy.

**Option B — CLI :**
```bash
npm i -g supabase
supabase login
supabase link --project-ref aitqnonioyhurbystfnk
supabase functions deploy notify-decision
```

## Étape 3 — Secrets de la fonction

Edge Functions → `notify-decision` → **Secrets** (ou `supabase secrets set`) :
- `RESEND_API_KEY` = ta clé Resend (`re_...`)
- `FROM_EMAIL` = expéditeur vérifié, ex. `CS Rives <cs@ton-domaine.fr>`
- `APP_URL` = `https://cs-rives.vercel.app` (optionnel)

## Étape 4 — Déclencheur (Database Webhook)

Supabase → **Database** → **Webhooks** → **Create a new hook** :
- **Table** : `decisions` · **Events** : `INSERT`
- **Type** : *Supabase Edge Functions* → choisis `notify-decision`
- (méthode POST, en-têtes par défaut) → **Create**

## Étape 5 — Tester

Crée une décision dans l'app → les membres actifs reçoivent l'email « Nouvelle
décision à voter » avec un bouton vers `/registre`.

> Astuce : commence par te mettre **toi seul** comme membre actif (ou vérifie
> juste ta propre adresse dans Resend) pour valider, avant d'activer pour tous.

---

## Notes

- La fonction envoie **un email par membre** (chacun ne voit que son adresse).
- Les mots de passe restent gérés par Supabase Auth (voir README §Signature/Auth).
- Pour ne notifier que certaines décisions, on pourra filtrer dans la fonction
  (ex. ignorer si `enregistree = true`). Dis-le moi si besoin.
