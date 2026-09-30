# Brief pour Claude Code — nouveau résumé des résolutions des archives de PV (v3, 30 septembre 2026)

## Pourquoi

Pascal juge les résumés actuels trop mécaniques : une ligne par sous-résolution (10.1 à 10.6 pour un seul sujet), des intitulés obscurs (« Budget prévisionnel 5 760 € : ligne travaux de 500 € annoncée… »), et aucune hiérarchie entre une décision qui engage le lotissement et un miroir remplacé. Le contenu a donc été réécrit par Claude (Cowork) à partir des PV relus sur l'image. **Ce brief porte uniquement sur l'implémentation** : le contenu est fourni et ne doit pas être reformulé.

## Le nouveau résumé

Pour chaque archive, deux listes :

1. **Résolutions importantes** : sujets suivis dans la durée par le lotissement (statut, cahier des charges et statuts, portails, réseaux d'eaux usées et pluviales, plage, arbres et article 15, contentieux, fonds de travaux, répartition des charges, zone C, divisions et servitudes), dépenses importantes, risques.
2. **Autres résolutions** : le reste des décisions de fond (miroirs, panneaux, contrats d'espaces verts, etc.).

Chaque ligne est un **résumé rédigé** qui peut regrouper une résolution et ses sous-points (entreprise, honoraires, financement) : par exemple « 10 — Remise en fonction des portails avec interphone : mandat au conseil syndical jusqu'à 50 000 € TTC, financé par appel de fonds… — Adoptée ». Le champ `numeros` indique les numéros couverts (« 10 », « 14 et 15 », « 10 à 12, 19 et 20 »).

Totaux : 39 archives, 92 résolutions importantes, 57 autres.

## Source

`scripts/data/resumes_resolutions_v3_2026-09-30.json` — un tableau de 39 objets :

```
{ "date_ag": "2023-12-16",
  "resolutions_importantes": [ { "ordre": 1, "numeros": "10", "resume": "…", "decision": "Adoptée", "vote": "Principe : Pour 2 081 · Contre 1 119 — mandat : Pour 2 381 · Contre 819" }, … ],
  "autres_resolutions": [ … ],
  "note_resume": "…" | null }
```

## Ce qu'il faut faire

1. **Sauvegarde du jour** avant toute écriture ; mode essai par défaut, écriture avec `--go`, idempotence, rapport horodaté dans `export/`.
2. **Stocker ce résumé comme une couche distincte**, rattachée à l'archive par `date_ag` (table ou champ jsonb, à ton choix). Il **ne remplace pas** les résolutions détaillées de `pv_archives` (les 303 lignes du registre, avec détail et voix) : celles-ci restent intactes et consultables.
3. **Ne toucher à aucun champ d'en-tête** de l'archive (président, scrutateur, secrétaire/syndic, quorum, lieu, unité, note) : ils ont été corrigés à la main dans l'application.
4. **Affichage de la fiche d'une archive** : en tête, la section « Résolutions importantes », puis « Autres résolutions », chacune en tableau N° · Résumé · Décision · Vote ; puis `note_resume` en petit. Le résumé doit s'afficher en entier (retour à la ligne, pas de troncature). Le détail des résolutions reste accessible en dessous ou par un lien « Détail des résolutions ».
5. **Couleurs de la colonne Décision** (par préfixe, dans cet ordre) : contient « déclaré » → ambre ; commence par « Adoptée » ou « Refus » → vert ; « Rejetée » ou « Régularisation rejetée » → rouge ; « Sans vote formel » → bleu clair `#DDEBF7` ; « Information », « Pas de vote », « Inconnu » → gris ; tout le reste (« Non votée », « Reportée », « Sans objet », « Vote non pris en compte », « Adoptée (non exécutée) ») → ambre. Attention : « Adoptée (non exécutée) » (1992) doit être ambre, pas vert.
6. **Marque `au_resume`** : elle n'a plus de sens avec des lignes regroupées ; à retirer ou à remplacer, à ton choix, sans supprimer de résolution détaillée.
7. **Vérification** : `export_md.mjs`, puis contrôler :
   - 39 archives, chacune avec ses deux listes (certaines « autres » sont vides) ;
   - 29/06/2002 : une seule ligne importante, n° 6, décision « Refus de fermer déclaré adopté » en ambre ;
   - 28/06/2008 : n° 9, « Sans vote formel » en bleu, résumé commençant par « Fermeture du lotissement : non retenue » ;
   - 16/12/2023 : n° 10 regroupe 10.1 à 10.6 en une ligne ;
   - en-têtes identiques à la sauvegarde d'avant écriture.

## À ne pas faire

- Ne pas reformuler, raccourcir ou fusionner les résumés : le contenu a été validé sur les PV.
- Ne pas recalculer les votes à partir des résolutions détaillées : le champ `vote` est rédigé pour le résumé.
