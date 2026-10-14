# Brief pour Claude Code — Mémoire de l'ASL : nouveau sujet « Circulation, vitesse et stationnement » (14 octobre 2026)

## Pourquoi

Pascal cherchait la règle des 30 km/h. Elle n'a jamais été votée et la mémoire n'en garde que deux traces, rangées dans « Portails et fermeture du lotissement ». Claude (Cowork) a relu les PV et les résumés ; les textes sont fournis et **ne se reformulent pas**.

## Source

`scripts/data/memoire_circulation_vitesse_2026-10-14.json` :

- `nouveau_sujet` : titre, catégorie (« Équipements »), résumé, synthèse en trois sections `{titre, texte}` ;
- `entrees_a_ajouter` : 11 entrées au format habituel (`date`, `titre`, `texte`, `source`, `resultat`, `archive`). ⚠ Le texte va dans le champ **`contenu`** de la table, pas « texte » ;
- `entrees_a_deplacer` : 2 entrées existantes. Celle du 31/08/1974 est **déplacée** vers le nouveau sujet. Celle du 03/08/1968 est **rattachée aux deux sujets** (elle concerne aussi la fermeture).

## Ce qu'il faut faire

1. Sauvegarde du jour de `sujets` et `sujet_entrees`. Mode essai par défaut, écriture avec `--go`. Idempotence : un sujet se reconnaît à son titre, une entrée à sujet + date + titre. Rapport horodaté dans `export/`.
2. Créer le sujet, ses entrées, puis faire les deux rattachements. Ne rien supprimer.
3. `resultat` « Sans vote formel » s'affiche en bleu clair `#DDEBF7`, comme ailleurs.
4. Vérifier avec `export_md.mjs` :
   - un sujet de plus, avec 13 entrées (11 nouvelles et les 2 rattachées) ;
   - « Portails et fermeture du lotissement » a une entrée de moins (1974) et garde celle de 1968 ;
   - le total des entrées augmente de 11.
