# Brief pour Claude Code — Mémoire : résultat point par point de la 2e consultation (14 octobre 2026)

## Pourquoi

L'entrée du 17/04/2025 du sujet « Statut juridique du lotissement » donne une fourchette globale (« POUR 76 à 82 % des colotis et 72.6 à 78.9 % des superficies »). Pascal veut le résultat **point par point**. Claude (Cowork) l'a recalculé à partir de l'export Excel du formulaire (42 réponses, 84 857 m²). Le texte est fourni et **ne se reformule pas**.

## Source

`scripts/data/consultation_2025_point_par_point_2026-10-14.json` :
- `corrections_entrees` : une seule entrée ; `champ` = **`contenu`** ; `ancien` vide = remplacer tout le texte ;
- `piece_jointe` : joindre le fichier Excel à cette entrée, comme les autres pièces jointes de la mémoire.

## Ce qu'il faut faire

1. Sauvegarde du jour de `sujet_entrees` ; essai par défaut, `--go` pour écrire ; idempotence (texte identique : rien à faire) ; rapport dans `export/`.
2. Conserver l'ancien texte dans l'historique ; auteur (Pascal Favre) et date inchangés.
3. Si la synthèse du sujet cite « 72,6 » ou « 72.6 », **ne pas la modifier** : le signaler dans le rapport.
4. Vérifier avec `export_md.mjs` que l'entrée affiche les 9 lignes et que la pièce jointe est présente.
