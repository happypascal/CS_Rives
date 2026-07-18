# État courant / point de reprise — Registre CS Rives

> Dernière session : **2026-07-18**. On **s'arrête ici**, en attendant deux choses :
> (1) le déroulé d'un **vrai vote / d'une AG** en conditions réelles, (2) les **retours des
> collègues du CS** sur l'application et le guide de démarrage.
>
> Fichier à lire en premier pour reprendre (après le `CLAUDE.md` du dépôt et `PASSATION.md`).

---

## En bref

L'application est **en production** (**https://cs-rives.vercel.app**) et **complète pour le
périmètre actuel** : registre des décisions (création, vote, enregistrement, verrou légal), AG +
résolutions, projets, budgets + CSV Foncia, PDF, signature par groupes homogènes, rôles du bureau.
La **base de production a été nettoyée** : elle contient les **5 vrais membres** du CS et l'AG
**`AGO-2026-001`** avec ses **8 résolutions** ; plus aucune donnée de test.

## Fait lors des dernières sessions (résumé — détail dans `PASSATION.md`)

- **Rôles du bureau** (président / trésorier / secrétaire / membre) et leurs 5 comportements :
  projet owned par son chef ; secrétaire qui fait signer et édite les AG ; garde d'engagement
  (adoption d'une décision financière = majorité **et** au moins trésorier ou président « Pour ») ;
  co-validation des comptes AGO (trésorier **et** président).
- Corrections : saisie des montants robuste (format suisse « 20'000 », plus de molette qui
  décrémente) ; bouton **« Enregistrer la décision »** remonté dans l'en-tête de page.
- **Nettoyage de la prod** + `audit_log` vidé.
- **Documentation** : `PASSATION.md` (reprise complète), `SPEC_ROLES.md`, `SPEC_SIGNATURE.md`,
  `TRANSFERT_ASL.md`, et le **guide de démarrage** pour les membres (`GUIDE_DEMARRAGE.md` +
  version Word `Guide_demarrage_CS.docx`, validée).

## Ce qu'on attend (raison de la pause)

1. **Un vrai vote / une AG** : valider le parcours en conditions réelles avant d'aller plus loin.
2. **Les retours des collègues** sur l'app et le guide.

## Backlog — à reprendre ensuite

- **Guide de démarrage, suite** (par-delà login / vote / création de décision) : créer et gérer
  une **AG**, saisir les **résolutions**, les **projets**, les **budgets**, la **signature**,
  l'**espace président** (enregistrement). Même format (Markdown + Word généré par script).
- **Traiter les retours** des collègues.
- **Signature Youtrust réelle** : encore un *mock*. Rester en manuel ou brancher — décision à
  prendre le moment venu (l'API a été écartée, trop chère).
- **Supabase Pro + transfert à l'identité ASL** (`TRANSFERT_ASL.md`) : le **seul vrai risque
  restant** — tout est sur l'identité personnelle de Pascal, et le plan gratuit n'a **aucune
  sauvegarde**. Organisationnel, pas technique, mais important.

## Repères techniques pour reprendre

- **Dépôt** : `github.com/happypascal/CS_Rives`, branche `main`. Déploiement Vercel automatique au
  push. Base Supabase `aitqnonioyhurbystfnk` (Paris).
- **Prochaine migration SQL libre** : `018`. (001-017 appliquées.)
- **Tester sans risque** : mode démo (déploiement Vercel sans les variables Supabase → backend
  mock ; comptes de test, mot de passe `demo`). 5 membres de test dont un trésorier.
- **Rappel workflow** : une migration s'applique **à la main** dans le SQL Editor **avant** de
  pousser le code qui en dépend. `npm run lint` avant de pousser.
