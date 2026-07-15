# Guide C — Notifications WhatsApp (CallMeBot)

À chaque nouvelle décision, l'app envoie déjà un **email**. Ce guide ajoute le
**message WhatsApp** en parallèle. Les deux canaux sont indépendants : si
WhatsApp échoue, l'email part quand même.

⏱️ ~5 min pour toi, ~2 min par membre.

---

## Comment ça marche (à savoir avant de commencer)

CallMeBot est un service **gratuit et non officiel**. Il ne peut pas écrire à un
numéro qui ne l'a pas autorisé : **chaque membre doit autoriser le bot depuis
son propre WhatsApp**, et reçoit en retour **sa clé personnelle**. C'est cette
clé que l'on colle dans sa fiche membre.

Conséquences à assumer :
- ⚠️ Le texte du message (n° et **titre de la décision** + lien) **transite par
  les serveurs de CallMeBot**. Aucune donnée de vote ni pièce jointe n'y passe,
  et le lien exige une connexion à l'app — mais le titre est visible par ce
  tiers. Si un titre est sensible, le canal WhatsApp n'est pas le bon endroit.
- ⚠️ Aucune garantie de service : pas de SLA, le service peut ralentir ou
  s'arrêter. Il ne remplace pas l'email, il le double.
- Si ces deux points deviennent gênants, on migrera vers l'API officielle Meta
  (compte Meta Business + numéro dédié + template approuvé) : seule la fonction
  `notify-decision` change, les colonnes `telephone` restent valables.

---

## Partie 1 — Appliquer la migration base de données

Supabase → **SQL Editor** → colle le contenu de
`supabase/migrations/003_membre_whatsapp.sql` → **Run**.

Cela ajoute deux colonnes facultatives à `membres_cs` : `telephone` et
`whatsapp_apikey`.

## Partie 2 — Chaque membre autorise le bot (2 min, à faire par le membre)

À envoyer à chaque membre du CS :

1. Enregistre le numéro du bot dans tes contacts, sous le nom **CallMeBot**
   (l'enregistrement est nécessaire pour que WhatsApp accepte).
   👉 Numéro à vérifier sur **https://www.callmebot.com/blog/free-api-whatsapp-messages/**
   (au moment de l'écriture : **+34 621 33 17 09** — le service peut le changer,
   la page fait foi).
2. Ouvre **WhatsApp** et envoie à ce contact le message exact :
   ```
   I allow callmebot to send me messages
   ```
3. Le bot répond en quelques secondes avec **ta clé API** (`Your APIKEY is 123456`).
4. Transmets au président : ton **numéro au format international**
   (ex. `+41791234567`) et cette **clé**.

> Si le bot ne répond pas, attends quelques minutes et renvoie le message.

## Partie 3 — Renseigner les fiches membres

Dans l'app → **Membres** → **Modifier** un membre → encart
**« Notification WhatsApp »** :
- **Téléphone WhatsApp** : format international, avec le `+` (ex. `+41791234567`)
- **Clé CallMeBot** : la clé reçue par ce membre

Enregistre. Un membre laissé sans numéro/clé reçoit simplement **l'email seul**.

## Partie 4 — Secrets de la fonction (optionnels)

Supabase → **Edge Functions** → `notify-decision` → **Secrets** :

| Secret | Rôle |
|---|---|
| `WHATSAPP_ENABLED` | `false` pour couper le canal WhatsApp. Absent = actif. |
| `TEST_WHATSAPP_PHONE` | Mode test : envoie **uniquement** à ce numéro… |
| `TEST_WHATSAPP_APIKEY` | …avec cette clé. Les deux ensemble, sinon ignorés. |

Le mode test WhatsApp est l'équivalent de `TEST_EMAIL` pour l'email : pratique
pour valider le mécanisme sur ton seul numéro avant d'ouvrir aux 4 membres.
**Laisse-les vides en production.**

## Partie 5 — Redéployer la fonction

Supabase → **Edge Functions** → `notify-decision` → colle le contenu à jour de
`supabase/functions/notify-decision/index.ts` → **Deploy**.

(Le webhook de la Partie 6 du Guide B reste inchangé.)

## Partie 6 — Tester

1. Renseigne `TEST_WHATSAPP_PHONE` + `TEST_WHATSAPP_APIKEY` avec **tes** valeurs.
2. Crée une décision dans l'app.
3. Tu dois recevoir l'email **et** le WhatsApp.
4. Diagnostic : Edge Functions → `notify-decision` → **Logs**. La ligne
   `notify-decision` contient le détail des deux canaux (`emails` et
   `whatsapps`, avec le statut et la réponse de chaque envoi).
5. Quand c'est bon : supprime les deux secrets de test → tous les membres
   renseignés reçoivent le WhatsApp.

---

## Le message envoyé

```
*Nouvelle décision à voter*
N° 12 — Réfection de la toiture du local technique
Date limite de réponse : 22/07/2026
Voter : https://cs-rives.vercel.app/registre
```
