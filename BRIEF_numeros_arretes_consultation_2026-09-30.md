# Brief pour Claude Code — Numéros des arrêtés préfectoraux et 2e consultation (30 septembre 2026, soir)

## Pourquoi

Les numéros des arrêtés préfectoraux inscrits dans la Mémoire de l'ASL sont faux, de même qu'un pourcentage de la deuxième consultation. Claude (Cowork) les a vérifiés sur les actes, en lisant l'image des pages :

- l'**arrêté n° 583-61 du 21 février 1961** (modification parcellaire Wipf / Belleville) : l'en-tête porte « ARRÊTÉ N° 583-61 », et les visas citent les arrêtés n° 3184-55 (22 août 1955), n° 755-56 (10 février 1956) et n° 32-57 (9 janvier 1957) ;
- l'**arrêté n° 1298-61** (cession de la plage communale) : ses visas citent les mêmes numéros (3184-55, 755-56, 32-57, 583-61), et son article I reprend le n° 3184-55.

Les numéros inscrits dans l'application (5184-55, 7955-56, 5835-61) viennent d'une mauvaise lecture. Pour la consultation du 17 avril 2025, l'application retient pour les colotis la colonne « D'accord TOTAL » (76 à 82 %), mais pour les superficies la colonne « D'accord » seule (70.3 %). On aligne les superficies sur la même colonne : 72.6 à 78.9 %.

**Ce brief ne demande que des remplacements ciblés.** Les textes sont fournis ; ils ne doivent pas être reformulés.

## Source

`scripts/data/numeros_arretes_consultation_2026-09-30.json` :

- `corrections_entrees` (7) : `{sujet, date, titre_actuel, champ (titre | texte), ancien, nouveau, source}`. On remplace **seulement** la chaîne `ancien` par `nouveau`, dans le champ indiqué. Le texte est du HTML issu de l'éditeur riche : le remplacement doit traverser les balises éventuelles. L'apostrophe et le tiret du `titre_actuel` peuvent être typographiques en base : la comparaison doit y être tolérante.
- `chaines_a_rechercher_partout` : chaînes à rechercher dans toute la base.
- `numeros_verifies` : pour information.

## Ce qu'il faut faire

1. **Sauvegarde du jour** de `sujets` et `sujet_entrees`, puis mode essai par défaut et écriture avec `--go`. Le script doit être idempotent : une correction déjà appliquée se reconnaît et n'est pas rejouée. Rapport horodaté dans `export/`. On peut réutiliser `corriger_memoire.mjs` si sa mécanique le permet.
2. Appliquer les 7 corrections. Si l'entrée n'est pas trouvée, ou si la chaîne `ancien` est absente ou présente plusieurs fois, **ne rien écrire pour cette correction** et le signaler dans le rapport.
3. **Garde-fous** :
   - une entrée liée à une décision du conseil syndical ne s'écrase pas : on ajoute un commentaire et on le signale ;
   - on conserve les dates, auteurs et pièces jointes ;
   - on ne touche ni à `pv_archives` ni à `resume_resolutions` ;
   - on ne supprime rien.
4. **Recherche globale** (lecture seule) : chercher chacune des `chaines_a_rechercher_partout` dans les sujets (résumé, synthèse), les entrées (titre, texte, résultat), les décisions du conseil, les commentaires et `parametres`. Lister dans le rapport toute occurrence restante hors historique, **sans la corriger**.
5. **Vérification** : lancer `export_md.mjs`, puis contrôler :
   - plus aucune occurrence de « 5184-55 », « 7955-56 » ni « 5835-61 » hors historique ;
   - « Urbanisme et servitudes » : titres « Arrêté préfectoral n° 3184-55 … », « n° 755-56 … », « n° 583-61 … » ;
   - « Arbres et plantations », entrée du 10/02/1956 : « Arrêté préfectoral n° 755-56 du 10 février 1956 », sans la parenthèse « numéro à vérifier » ;
   - « Statut juridique », entrée du 17/04/2025 : « 72.6 à 78.9% des superficies » ;
   - le nombre total d'entrées est inchangé.

## À ne pas faire

- Ne pas reformuler les textes, ne rien ajouter.
- Ne pas modifier les fichiers de données antérieurs (`scripts/data/*_2026-09-2*` et `*_2026-09-30.json` déjà exécutés).
