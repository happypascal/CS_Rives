# Guide A — Créer les comptes de connexion des membres

Objectif : chaque membre du CS doit pouvoir se connecter avec **son e-mail** et un
**mot de passe provisoire** qu'il changera ensuite. Tu as déjà saisi les membres
(leurs profils) ; il manque leur **compte de connexion**.

> Ton compte président existe déjà. Tu ne recrées un compte que pour les membres
> qui n'en ont pas encore.

---

## 1. Retrouver les e-mails des membres

1. Ouvre la table des membres :
   **https://supabase.com/dashboard/project/aitqnonioyhurbystfnk/editor**
2. Dans la liste de gauche, clique la table **`membres_cs`**.
3. Note les **e-mails** exacts de chaque membre (colonne `email`). Tu en auras besoin à l'identique.

## 2. Créer un compte de connexion (à répéter pour chaque membre)

1. Ouvre la page des comptes :
   **https://supabase.com/dashboard/project/aitqnonioyhurbystfnk/auth/users**
2. En haut à droite, clique **« Add user »** → **« Create new user »**.
3. Remplis :
   - **Email address** : l'e-mail du membre (⚠️ EXACTEMENT le même que dans `membres_cs`).
   - **Password** : un mot de passe **provisoire** (voir tableau ci-dessous).
   - Coche **« Auto Confirm User? »** (sinon il devra confirmer par email).
4. Clique **« Create user »**.
5. Recommence pour chaque membre.

### Suggestion : note tes mots de passe provisoires

| Membre | E-mail | Mot de passe provisoire |
|---|---|---|
| (membre 1) | … | ex. `Rives-2026-Aa` |
| (membre 2) | … | ex. `Rives-2026-Bb` |
| (membre 3) | … | ex. `Rives-2026-Cc` |

> Choisis des mots de passe d'au moins 8 caractères. Chacun changera le sien au
> premier accès, donc peu importe qu'ils soient simples au départ.

## 3. Empêcher les inscriptions libres (recommandé)

1. Ouvre **https://supabase.com/dashboard/project/aitqnonioyhurbystfnk/auth/providers**
2. Section **Email** → désactive **« Allow new users to sign up »** → **Save**.
   (Ainsi, seuls les comptes que TU crées peuvent exister.)

## 4. Transmettre à chaque membre

Envoie à chacun (email, SMS, WhatsApp…) :
- l'adresse de l'app : **https://cs-rives.vercel.app**
- son **e-mail** de connexion
- son **mot de passe provisoire**
- le fichier **`Guide_membre_vote.doc`** (instructions de vote)

## 5. Ce que fait le membre au 1er accès

1. Il ouvre https://cs-rives.vercel.app et se connecte (email + mot de passe provisoire).
2. Il va dans **Paramètres → Mon mot de passe** et définit **son** mot de passe.
3. S'il l'oublie plus tard : écran de connexion → **« Mot de passe oublié ? »** →
   il reçoit un email → il définit un nouveau mot de passe.

---

✅ Une fois les comptes créés et transmis, les membres peuvent voter.
