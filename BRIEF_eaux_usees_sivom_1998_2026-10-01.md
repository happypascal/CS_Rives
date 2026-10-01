# Brief pour Claude Code — Eaux usées : lettre du SIVOM du 19 mai 1998 (1er octobre 2026)

## Pourquoi

Pascal a versé au dossier la lettre du SIVOM du Bas-Chablais du 19 mai 1998 et ses annexes (8 pages : lettre, conclusion du rapport de la Régie départementale d'assistance, estimatif, plan du tracé, plans du poste de refoulement). C'est la proposition que l'AG du 20 juin 1998 a entérinée (point VII). Claude (Cowork) l'a lue sur l'image. **Ce brief ne porte que sur l'implémentation** : les textes sont fournis et ne se reformulent pas.

## Source

`scripts/data/eaux_usees_sivom_1998_2026-10-01.json` :

- `entree_a_ajouter` : une entrée dans le sujet « Eaux usées et assainissement », datée du 19/05/1998, avec `titre`, `texte`, `resultat` (« Information »), `source` et `piece`.
- `piece` : chemin relatif à la racine `_1_lotissement`. Le fichier se trouve aujourd'hui dans `3_procédures/SCI Maison du Lac/`. **S'il n'y est plus, cherche `Assainissement19.05.98.pdf` dans `7_Réseau Eaux Usées/`** et prends ce chemin. S'il n'est à aucun des deux endroits, n'attache rien et signale-le.
- `synthese_edits` (2) : **éditions ciblées** dans deux sections de la synthèse du sujet. Remplace seulement la chaîne `ancien` par `nouveau`. Le reste de la synthèse ne change pas.

## Ce qu'il faut faire

1. **Sauvegarde du jour**, puis mode essai par défaut et écriture avec `--go`. Le script doit être idempotent : une entrée déjà présente (même sujet, même date, même titre) ne se recrée pas, et une édition déjà faite se reconnaît à sa chaîne `nouveau`. Rapport horodaté dans `export/`.
2. Ajouter l'entrée et attacher la pièce **à l'entrée**, pas au sujet.
3. Appliquer les deux éditions de la synthèse. Si `ancien` est absent ou présent plusieurs fois, ne rien écrire pour cette édition et le signaler. L'ancienne synthèse est conservée dans l'historique, comme pour la migration 065.
4. **Garde-fous** :
   - on ne supprime rien ;
   - aucune autre entrée n'est touchée ;
   - on ne touche ni à `pv_archives` ni à `resume_resolutions` ;
   - si la synthèse est liée à une décision du conseil, on ajoute un commentaire au lieu d'écrire.
5. **Vérification** : lancer `export_md.mjs`, puis contrôler :
   - le sujet compte 8 entrées, et la base 252 ;
   - la nouvelle entrée apparaît le 19/05/1998, avec sa pièce jointe ;
   - la section Historique contient « Mai 1998 : le SIVOM écrit au syndic » suivi de « Juin 1998 : la proposition du SIVOM est entérinée » ;
   - la section Questions ouvertes contient « la lettre du 19 mai 1998 n'en est que la proposition ».

## À ne pas faire

- Ne pas reformuler, raccourcir ni compléter les textes.
- Ne pas déplacer ni renommer le fichier de Pascal.
