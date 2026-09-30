# Brief pour Claude Code — Mémoire de l'ASL : corrections, synthèses, nouveaux sujets (30 septembre 2026)

## Pourquoi

Pascal juge les sujets de la « Mémoire de l'ASL » peu utiles. Les synthèses sont trop minces ou absentes, et plusieurs entrées sont fausses : 2008 « adoptée à l'unanimité », un « Pour : 72 854 », une « résolution 10-2 » qui n'existe pas. Les entrées issues des archives sont éclatées en sous-résolutions (10.1 à 10.6) aux titres illisibles (« Portails »). Le contenu a été réécrit par Claude (Cowork) à partir des PV relus sur l'image et des pièces du dossier. **Ce brief porte uniquement sur l'implémentation** : les textes sont fournis et ne doivent pas être reformulés.

## Source

`scripts/data/memoire_sujets_2026-09-30.json` :

- `sujets` (12 existants), chacun avec, selon les cas :
  - `resume` : remplace le résumé ;
  - `synthese` : liste de sections `{titre, texte}` qui remplace la synthèse. Pour « Contentieux SCI Violette », `synthese_mode: "remplacer_en_conservant"` : la nouvelle version reprend l'ancienne texte pour texte, avec une correction (voir `note_revision`) ;
  - `synthese_ajout` (« Urbanisme et servitudes », `action: "completer"`) : section à **ajouter à la fin** de la synthèse existante, sans toucher au reste ;
  - `corrections_entrees` : `{date, titre_actuel, champ (titre | texte | resultat), ancien, nouveau, motif}`. Si `ancien` est fourni, remplacer seulement ce passage (édition ciblée) ; s'il est vide ou absent pour `texte`, remplir le texte vide ou remplacer le texte entier comme indiqué. **Les corrections marquées `a_verifier: true` ne s'appliquent pas** : il faut seulement les lister dans le rapport ;
  - `entrees_a_ajouter` : nouvelles entrées `{date, titre, texte, source, resultat?, archive?}` ;
  - `regroupements` : une entrée consolidée `{date, numeros, titre, texte, resultat, vote}` qui remplace à l'affichage les entrées listées dans `titres_regroupes` (même date, même sujet ; un titre répété désigne plusieurs entrées) ;
  - `detacher` : retirer l'entrée du sujet ;
  - `entrees_a_deplacer` + `deplacer_vers` (Urbanisme) : 16 entrées à rattacher au nouveau sujet « Arbres et plantations (article 15) ».
- `nouveaux_sujets` (2) : « Arbres et plantations (article 15) » et « Eaux usées et assainissement », avec catégorie, résumé, synthèse et entrées.
- `points_a_verifier_par_pascal` : à recopier tels quels en fin de rapport.

Totaux : 40 corrections (dont 5 à vérifier, non appliquées), 22 entrées ajoutées aux sujets existants, 16 regroupements, 3 détachements, 16 déplacements, 2 nouveaux sujets avec 14 entrées.

## Ce qu'il faut faire

1. **Sauvegarde du jour** de `sujets` et `sujet_entrees` avant toute écriture ; mode essai par défaut, écriture avec `--go`, idempotence (comparaison canonique, comme pour la migration 064), rapport horodaté dans `export/`.
2. **Ne rien supprimer.**
   - « Détacher » et « déplacer » ne changent que le rattachement ; l'archive du PV n'est pas touchée.
   - Un regroupement crée l'entrée consolidée et range les entrées regroupées dessous, repliées (« Détail : 6 résolutions »). Mécanisme à ton choix, mais sans perte ; les entrées regroupées ne s'affichent plus à plat dans la chronologie du sujet.
3. **Historique** : conserver l'ancien résumé et l'ancienne synthèse de chaque sujet (table d'historique ou champ dédié, à ton choix) avant de les remplacer.
4. **Affichage de la synthèse** : sections avec intertitre (`titre`) et paragraphe (`texte`). Le texte s'affiche en entier.
5. **Garde-fous** :
   - si une entrée ou une synthèse est liée à une décision du conseil syndical, ne pas l'écraser : ajouter le nouveau texte en commentaire et le signaler ;
   - pièces jointes, auteurs et dates existants conservés ;
   - `pv_archives` et `resume_resolutions` non touchés ;
   - le script refuse d'écrire si le nombre total d'entrées diminue.
6. **Résultats** : « Décision sans vote formel » s'affiche en bleu clair `#DDEBF7`, comme dans les archives.
7. **Vérification** : `export_md.mjs`, puis contrôler :
   - 14 sujets ;
   - Portails, 28/06/2008 : « Fermeture non retenue : la situation actuelle est maintenue », résultat « Décision sans vote formel », plus aucune mention « adoptée à l'unanimité » dans le texte ;
   - Zone C, résolution 4 : « Pour : 75 540 » ;
   - Réseau EP : plus aucune « Résolution 10-2 » dans les titres ni dans la synthèse ;
   - Portails, 16/12/2023 : une seule entrée affichée pour la résolution 10, avec 6 entrées en détail ;
   - aucune entrée perdue (total avant = total après + 0) ;
   - numéros d'arrêtés inchangés (corrections `a_verifier`).

## À ne pas faire

- Ne pas reformuler, raccourcir ou fusionner les textes fournis.
- Ne pas corriger les points `a_verifier`.
- N'ajouter aucune information absente du fichier.
