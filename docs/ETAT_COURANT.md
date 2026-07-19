# État courant / point de reprise — Registre CS Rives

> Dernière session : **2026-07-19**. Les collègues du CS **éprouvent la maquette en conditions
> réelles** : premiers votes réels, premiers retours, premiers bugs corrigés. ⚠ C'est une
> **maquette de validation**, pas encore un registre de production (voir « En bref »). On met en
> place un **environnement de recette (staging)** pour tester les droits sans polluer la base live.
>
> Fichier à lire en premier pour reprendre (après le `CLAUDE.md` du dépôt et `PASSATION.md`).
> Pour le staging/UAT, voir **`docs/STAGING_UAT.md`**.

---

## En bref

L'application est une **maquette de validation** (**https://cs-rives.vercel.app**),
**fonctionnellement complète pour le périmètre actuel** : registre des décisions (création, vote,
enregistrement, verrou légal), AG + résolutions, projets, budgets + CSV Foncia, PDF, signature par
groupes homogènes, rôles du bureau. La base live contient les **5 vrais membres** du CS et l'AG
**`AGO-2026-001`** (8 résolutions).

⚠ **Ce n'est PAS encore un registre de production**, et il ne faut pas le présenter comme tel :
- **Aucune sauvegarde** des données (Supabase gratuit) — une perte serait définitive.
- **Pas de signature électronique valide** — le module est un *mock* (`yousignProvider` throw) ;
  l'exigence de signature de l'art. 15 n'est donc pas remplie par voie électronique.

La fiabilisation (Supabase Pro + sauvegardes, signature réelle, transfert à l'ASL) fait l'objet
du budget demandé à l'AG et du backlog ci-dessous.

## Session 2026-07-19 — validation en conditions réelles + corrections

- **🔴 Bug prod corrigé — casse d'email (RLS).** Un membre (Marc) pouvait lire et télécharger
  mais **ni voter ni publier en Q/R**. Cause : `membres_cs.email` = `Marc@…` (majuscule) ≠ email
  d'Auth `marc@…` (minuscule) → `current_membre_id()` (comparaison stricte) renvoyait `null` →
  toute écriture liée à l'identité rejetée par la RLS ; les lectures passaient (aucune identité
  requise). **Fix appliqué** en base : `update membres_cs set email = lower(trim(email))`. Les 4
  autres membres étaient déjà OK (audit fait). Le membre doit **se reconnecter** pour recharger
  son `membre_id`.
  - ✅ **Durcissement fait — migration `018` appliquée en prod (2026-07-19).** Appariement email
    **insensible à la casse** partout : les 4 helpers RLS (`is_admin`, `is_secretaire`,
    `is_tresorier`, `current_membre_id`) comparent en `lower()=lower()` ; `resolveUser` matche la
    forme canonique ; `createMembre`/`updateMembre` normalisent l'email ; un **trigger**
    `membres_cs_normalize_email` garantit `lower(trim())` en base quel que soit le client. **Et**
    la surface d'erreur : `DecisionDetail.jsx` enveloppe vote / retrait / commentaire / question /
    réponse dans un `try/catch` → un rejet RLS **s'affiche** au lieu de rester silencieux.
    **Validé sur staging** (création membre `Test@…` → normalisé, vote/Q-R OK) puis appliqué prod.
    ⚠ Piège rencontré : l'éditeur Supabase parse mal plusieurs fonctions `$$` — 018 utilise des
    **balises nommées uniques** (`$is_admin$`, `$current_membre$`, …).
- **✅ Champs multi-lignes auto-extensibles (déployé prod, commit `96ab1f8`).** Les saisies
  question / réponse / commentaire de vote passent de `<input>` mono-ligne à un `Textarea` qui
  épouse son contenu. `ui.jsx` : `Textarea` gagne une option **`autoGrow`** (opt-in, non cassante ;
  redimensionne sur `onInput` pour les champs non contrôlés + effet sur `value` pour les contrôlés)
  et rend le `<textarea>` nu quand il n'y a pas de `label` (enfant flex direct).
- **Staging préparé** : `supabase/seed_staging.sql` (données de recette), branche `staging`
  poussée (déclenche un déploiement Preview Vercel), procédure complète dans `docs/STAGING_UAT.md`.
  **Reste côté Pascal** (manuel) : créer le projet Supabase staging, ses 5 comptes Auth, et
  scoper les variables Vercel **Preview → staging** (⚠ vérifier que les variables prod sont bien
  `Production` seulement, sinon le staging taperait dans la prod).

## Backlog — à reprendre ensuite

- **Budget de fonctionnement à soumettre à l'AG** (arbitrage CS 2026-07-20). Le CS demande à l'AG
  une **enveloppe annuelle de 720 €/an** (Supabase 22 + signature 9 + domaine 1 + Claude 18 =
  **50 €/mois ≈ 600 €**, marge incluse) pour faire passer la **maquette en registre de production**
  (sauvegardes, signature réelle) **et** transférer les comptes/abonnements à l'ASL. **Majorité
  simple**, **sans remboursement** (rien n'a été avancé au-delà des offres gratuites). Claude est
  assumé comme coût de **maintenance transférable** (le successeur en aura besoin), pas un abonnement
  perso. Textes de la **décision CS** (sans cible, montant 0 — elle ne fait que saisir l'AG) et de
  la **résolution AG** (`a_voter`, 720 €) rédigés en session, à saisir dans l'app. Voir
  `TRANSFERT_ASL.md`.
- **Terminer le staging** (`docs/STAGING_UAT.md`) : côté Pascal, il reste à créer le projet
  Supabase staging, ses 5 comptes Auth, et scoper les variables Vercel **Preview → staging**.
  _(Le durcissement casse-insensible + surface d'erreur Q/R/vote — migration `018` — est **fait**
  et **déployé en prod** : voir la session 2026-07-19 ci-dessus.)_
- **Guide de démarrage, suite** : créer/gérer une AG, résolutions, projets, budgets, signature,
  espace président. Même format (Markdown + Word généré par script).
- **Traiter les retours** des collègues.
- **Signature Youtrust réelle** : encore un *mock*. Décision : plan payant **One 9 €/mois retenu**
  (désormais intégré au budget **720 €/an** soumis à l'AG — voir la ligne budget en tête de
  backlog) ; l'API a été écartée (trop chère). Reste à brancher le provider réel.
- **Supabase Pro + transfert à l'identité ASL** (`TRANSFERT_ASL.md`) : le **seul vrai risque
  restant** — tout est sur l'identité personnelle de Pascal, plan gratuit sans sauvegarde.
  Organisationnel, pas technique, mais important.
- **Notifications automatiques par email — À FAIRE APRÈS L'AG** (arbitrage Pascal 2026-07-20).
  Choix retenu : **email automatique** sur 4 déclencheurs, **+ conserver le bouton manuel
  « Prévenir le CS »** (`wa.me`, `share.js`) pour poster dans le **groupe** WhatsApp. Déclencheurs :
  (1) nouvelle décision à voter, (2) réponse à un fil Q/R où j'ai posté, (3) décision enregistrée,
  (4) lot de signature qui m'est adressé.
  - **Pourquoi email, pas WhatsApp-API** : l'API WhatsApp (officielle ou Twilio) n'écrit qu'en
    **1-à-1 vers un numéro, jamais dans un groupe** → elle perd l'intérêt du groupe CS. L'email est
    **auditable** (ce qui compte pour un registre légal), réutilise `membres_cs.email` (pas besoin
    de re-stocker les téléphones supprimés en **migration 004**), et évite la validation de
    templates Meta. Le bouton `wa.me` manuel garde, lui, l'accès au **groupe**.
  - **Bloqueurs (donc strictement post-budget)** : (a) **domaine vérifié** requis, financé par la
    décision AG, pas encore acheté ; (b) réintroduit une **Edge Function** Supabase (le projet n'en
    a AUCUNE — choix assumé) pour tenir le secret d'envoi côté serveur (le token ne peut pas vivre
    dans le client). Envoi via **Resend** (domaine vérifié) ou SMTP. C'est une **décision d'archi**
    à acter avant de coder.
  - **Rappel `CLAUDE.md`** : la notif manuelle est un choix documenté (« ne pas réintroduire d'envoi
    automatique sans demande explicite »). **Cette entrée EST la demande explicite** qui lève le
    garde-fou — mais uniquement pour l'**email**, et **après l'AG**.

## Repères techniques pour reprendre

- **Dépôt** : `github.com/happypascal/CS_Rives`. `main` → Vercel **Production**, toute autre
  branche (dont `staging`) → **Preview**. Déploiement automatique au push.
- **Bases Supabase** : prod `aitqnonioyhurbystfnk` (Paris) ; staging = 2ᵉ projet à créer.
- **Prochaine migration SQL libre** : `019` (001-018 appliquées en prod ; 018 = appariement email
  insensible à la casse + trigger de normalisation).
- **Tester sans risque** : le **staging** (vraie RLS, données isolées) — cf. `docs/STAGING_UAT.md`.
  Le mode démo (mock, sans variables Supabase) ne teste **pas** les droits.
- **Rappel workflow** : une migration s'applique **à la main** dans le SQL Editor **avant** de
  pousser le code qui en dépend. `npm run lint` avant de pousser.
