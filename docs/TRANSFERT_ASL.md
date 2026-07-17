# Transfert de l'infrastructure vers l'identité de l'ASL

> État au 2026-07-17 : **rien n'est engagé**. Ce document est le plan, pas un compte rendu.
> Coût cible : **~31 €/mois** (~370 €/an). Tarifs **non revérifiés en ligne** — les
> recontrôler avant de les présenter à l'ASL.

## Pourquoi

Tout repose aujourd'hui sur l'identité personnelle de Pascal Favre. S'il cesse d'être
président — ou se fait renverser un bus — l'ASL perd l'accès à son propre registre légal.
Le but n'est pas d'économiser : c'est de rendre l'association **propriétaire de ses outils**.

L'argument budgétaire auprès de l'ASL est la **sauvegarde**, pas la pause : le plan gratuit
Supabase n'a **aucune sauvegarde automatique**. Une mise en pause est un désagrément, une
perte de données est définitive — indéfendable pour un registre que la loi impose de tenir.
Pro donne des sauvegardes quotidiennes (7 jours de rétention). Le PITR (~100 $/mois) est
inutile ici.

## Ce qui N'EST PAS concerné

- **Les comptes des membres et le président de l'app.** `is_admin()` teste
  `membres_cs.email = auth.jwt()->>'email'` avec `role='president'` et `actif` : l'admin suit
  le **mandat**, pas la personne. Un nouveau président devient admin dès que son email porte
  le rôle. **Ne pas remplacer l'email du président par une adresse générique de l'ASL** :
  l'art. 15 fait signer des *personnes présentes*, pas une boîte aux lettres.
- **Le code.** `pfavre25@gmail.com` n'apparaît que dans le seed du mock (`mockDb.js`), le
  pré-remplissage du login en mode démo (`Login.jsx`) et `seed.sql` (bootstrap d'une install
  neuve). Rien de tout cela ne tourne en production.

## Inventaire

| # | Actif | Propriétaire actuel | Cible | Risque |
|---|---|---|---|---|
| 1 | Dépôt `happypascal/CS_Rives` | compte GitHub perso | organisation GitHub de l'ASL | faible |
| 2 | Projet Vercel → `cs-rives.vercel.app` | compte Vercel perso (Hobby) | équipe Vercel de l'ASL | moyen |
| 3 | Projet Supabase `aitqnonioyhurbystfnk` | organisation Supabase perso (Free) | organisation ASL (**Pro**) | **élevé** |
| 4 | Compte Youtrust (signature) | perso | compte ASL | faible (pas encore branché) |
| 5 | Identité git locale | `happypascal` / `pfa@deckpoint.ch` | inchangée | nul |
| 6 | Compte Resend + webhook `notif-nouvelle-decision` | perso | **à supprimer** | nul |

À créer : un domaine (~12 €/an, **imposé par Google Workspace**) et un Google Workspace
Business Starter (~7 €/compte/mois) portant l'identité de l'ASL.

## Ordre des opérations

L'ordre n'est pas cosmétique : chaque étape dépend de la précédente.

### 0. Sauvegarder — AVANT de toucher à quoi que ce soit

Le plan gratuit n'a aucune sauvegarde. Tant que le Pro n'est pas actif, **le seul filet est
celui qu'on tend soi-même**.

- Supabase → SQL Editor, ou `pg_dump` via la chaîne de connexion (Settings → Database).
- Exporter aussi le contenu du bucket `documents` (Storage → télécharger).
- Garder le dump hors ligne jusqu'à la fin du transfert.

### 1. Domaine + Google Workspace

Rien d'autre ne peut avancer sans l'adresse de l'ASL — elle sert à créer tous les comptes.

1. Acheter le domaine chez un registrar.
2. Créer le Workspace Business Starter dessus, puis le compte de service de l'ASL
   (ex. `registre@…`). **Ce compte devient le propriétaire de tout ce qui suit.**
3. Activer la double authentification dessus, et consigner les identifiants là où le CS peut
   les retrouver sans Pascal — sinon on a déplacé le problème, pas résolu.

### 2. GitHub (le moins risqué — commencer par là)

1. Depuis le compte ASL : créer une organisation (Free suffit — dépôts privés et
   collaborateurs illimités ; Team n'ajoute que branches protégées et code owners, sans
   intérêt à deux).
2. Depuis `happypascal` : Settings → Transfer ownership → l'organisation.
3. Ajouter `happypascal` comme owner de l'organisation.
4. Mettre à jour le remote local :
   `git remote set-url origin https://github.com/<org>/CS_Rives.git`
   (GitHub redirige l'ancienne URL, mais un remote qui ment finit par piéger quelqu'un.)
5. ⚠ **Réautoriser l'application GitHub de Vercel sur l'organisation**, sinon le
   déploiement automatique se tait sans erreur visible.

### 3. Vercel

1. Depuis le compte ASL : créer une équipe.
2. Depuis le compte perso : Project Settings → Transfer → l'équipe.
3. **Vérifier les variables d'environnement après transfert** (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `VITE_SIGNATURE_PROVIDER`, `VITE_TEST_VOTES`). Ne pas supposer
   qu'elles ont suivi.
4. Forcer un redéploiement et vérifier que le site répond.

⚠ **Vercel Hobby interdit l'usage commercial.** Un registre d'ASL ne l'est probablement pas,
mais c'est une zone grise : la trancher maintenant, pas le jour où le compte est suspendu.

### 4. Supabase (le plus risqué)

1. Depuis le compte ASL : créer une organisation, **passer au plan Pro**, y mettre le moyen
   de paiement de l'ASL.
2. Inviter `happypascal` comme **Owner** de cette organisation. Le transfert exige d'être
   owner **des deux** organisations.
3. Project Settings → General → **Transfer project** → l'organisation de l'ASL.
4. ⚠ **À vérifier immédiatement** : la référence du projet (`aitqnonioyhurbystfnk`) doit
   rester **inchangée**. Si elle l'est, l'URL de l'API, les clés, les variables Vercel et le
   script keepalive continuent de fonctionner sans rien toucher — le transfert est alors
   transparent pour la prod. Si elle change, **tout casse** : ne pas continuer, revenir vers
   Claude.
5. Confirmer que les sauvegardes quotidiennes sont actives (Database → Backups).

### 5. Domaine sur l'app

1. Vercel → Domains → ajouter `registre.<domaine>`, poser les DNS chez le registrar.
2. ⚠ **Supabase → Authentication → URL Configuration** : ajouter le nouveau domaine aux
   redirect URLs (`https://registre.<domaine>/**`). **Sans ça, la réinitialisation de mot de
   passe casse** — le lien reçu par mail renverra vers l'ancienne adresse.
3. Garder `cs-rives.vercel.app` actif un temps : les membres ont le lien.

### 6. Ménage, une fois tout vert

- **Désactiver le keepalive** du Mac — le Pro supprime la pause :
  `launchctl unload ~/Library/LaunchAgents/com.attanorm.supabase-keepalive.plist`
- Supprimer le webhook `notif-nouvelle-decision`, la fonction `notify-decision` et ses
  secrets ; fermer le compte Resend (plus utilisé depuis le passage aux notifications
  manuelles).
- Mettre à jour `docs/GUIDE_A_comptes_membres.md` **si** la référence Supabase a changé
  (elle y est en dur). Normalement : rien à faire.

## Le vrai risque

Aucune de ces étapes n'est difficile. Le risque est de **s'arrêter au milieu** : un
Workspace créé et payé, mais des comptes toujours sur l'identité de Pascal, donne l'illusion
d'une association autonome sans qu'elle le soit. Le transfert Supabase (§4) est celui qui
compte — les autres sont du confort. Tant qu'il n'est pas fait, l'ASL ne possède pas son
registre.
