# Brief pour Claude Code — corrections des archives de PV (revalidation du 30 septembre 2026)

## Contexte

Pascal Favre a relevé une erreur dans le résumé de l'AG du 28 juin 2008 : le point 9 était affiché « Fermeture du lotissement — Adoptée — Unanimité », alors que le PV ne met rien aux voix et relate que l'assemblée « décide unanimement le maintien de la situation actuelle » (le lotissement n'est pas fermé). Les 39 PV (1988 à 2026) ont donc été relus intégralement sur l'image de chaque page, sans OCR, et chaque ligne des résumés, du registre et de la synthèse a été confrontée au texte. Bilan : 21 erreurs, 139 imprécisions, 21 doutes et 4 omissions, tous traités ci-dessous.

Principale cause : des décisions relatées au PV sans formule de vote ni décompte (« l'assemblée considère », « prend acte et entérine », « donne mission », « il est décidé ») étaient qualifiées « Adoptée », et certains sujets reprenaient l'intitulé de l'ordre du jour au lieu de ce qui a été décidé. Une nouvelle qualification est introduite : **« Décision sans vote formel »**.

## Ce qu'il faut faire dans l'application

Conventions habituelles : mode essai par défaut, écriture avec `--go`, sauvegarde du jour exigée avant écriture, idempotence, rapport horodaté dans `export/`.

1. **Sauvegarde** : `scripts/backup.mjs` avant toute écriture.
2. **Archives des PV (`pv_archives`) — résumé des résolutions uniquement** : la source est `scripts/data/resumes_pv_archives_2026-09-30.json`. Pour chaque archive existante, identifiée par `date_ag`, **remplacer uniquement la liste des résolutions** (numéro, sujet, décision, résultat du vote). **Ne pas toucher aux champs d'en-tête** (président, scrutateur, secrétaire/syndic, quorum, lieu, unité des votes, note) : le nom du syndic et le lieu ont été corrigés à la main dans l'application et ne doivent pas être écrasés. Pour les 4 archives absentes (21/07/1990, 30/07/1994, 29/07/1995, 28/06/1997), les créer avec les données du JSON. Ne pas créer d'AG dans `assemblees_generales` ; `annee` = année d'exercice. Aucune migration n'est nécessaire.
3. **Nouvelle valeur de décision** : « Décision sans vote formel » (affichage conseillé en bleu clair `#DDEBF7`). Autres valeurs désormais utilisées : « Information (sans vote) », « Sans objet », « Inconnu », « Vote non pris en compte », « À examiner (sans vote) », « Demande (sans vote) », « Déclarée adoptée (majorité de l'art. 25 non atteinte) ». Si l'application colore ou filtre par résultat, gérer ces libellés (tout ce qui ne commence pas par « Adoptée » ou « Rejetée » ne doit pas être compté comme adopté ou rejeté).
4. **Synthèse (`parametres`, clé `pv_archives_synthese`)** : remplacer le document par la nouvelle version `1_AG/Synthese_AG_Rives_par_sujet.pdf` (8 pages, datée du 30 septembre 2026).
5. **Vérification** : relancer `scripts/export_md.mjs` et contrôler dans `export/` : (a) 39 archives ; (b) pour le 28/06/2008, point 9 = « Fermeture du lotissement NON retenue … » / « Décision sans vote formel » ; (c) pour le 03/07/2010, aucune ligne « Adoptée » aux points 10 et 11 ; (d) pour le 30/06/2007, point 7 = mandat d'instruire, fermeture non décidée.
6. **Rapport** : lister dans le rapport horodaté chaque archive modifiée et chaque champ changé.

## Liste des erreurs trouvées et corrigées — résumé des résolutions (données de l'application)

Les corrections d'en-tête (président, scrutateur, secrétaire, quorum, type) ont été faites dans les résumés Word et PDF mais ne concernent pas l'application : elles ne figurent pas ici.

Colonnes : AG · élément · avant · après · source (page du PV lue sur l'image).

### 2 juillet 1988 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 1 (V présumé (IV de la convocation)) — num | V (IV de la convocation) | V présumé (IV de la convocation) | p. 19 du fichier (seule page du PV) ; convocation p. 1 |
| ligne 1 (V présumé (IV de la convocation)) — resultat | Inconnu (page manquante) | Inconnu (point absent du PV conservé) | p. 19 du fichier (seule page du PV) ; convocation p. 1 |
| ligne 1 (V présumé (IV de la convocation)) — vote | Non chiffré au PV | Inconnu | p. 19 du fichier (seule page du PV) ; convocation p. 1 |

### 1er juillet 1989 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 1 (VI) — sujet | Action de M. Alain Le Corre contre la barrière à l'entrée : défense du syndicat (Me Yves Redon) | Action de M. Alain Le Corre contre la décision de poser une barrière : lecture de l'assignation et des conclusions déposées pour le syndicat (Me Yves Redon) | p. 2, point VI |

### 21 juillet 1990 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 1 (VII) — resultat | Adoptée | Mission confiée (vote non visible) | p. 2 (« suite n° 2 ») ; page « suite n° 1 » absente |
| ligne 1 (VII) — vote | Non chiffré (début du point sur la page manquante) | Inconnu (début du point sur la page manquante) | p. 2 (« suite n° 2 ») ; page « suite n° 1 » absente |
| ligne 2 (VIII) — resultat | Reportée | À examiner (sans vote) | p. 2, questions diverses |
| ligne 2 (VIII) — vote | — | — | p. 2, questions diverses |
| ligne 3 (VIII) — resultat | Reportée | À examiner (sans vote) | p. 2, questions diverses |
| ligne 3 (VIII) — vote | — | — | p. 2, questions diverses |

### 27 juillet 1991 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 9 (XI) — sujet | Autres ralentisseurs à l'ordre du jour de l'assemblée suivante | Autres « amortisseurs » (sic, vraisemblablement ralentisseurs), sur demande de copropriétaires, à prévoir à l'ordre du jour suivant | p. 2 (suite), point XI |
| ligne 9 (XI) — resultat | Reportée | À l’ordre du jour suivant (sans vote) | p. 2 (suite), point XI |

### 25 juillet 1992 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 1 (I) — resultat | Adoptée | Décision sans vote formel | p. 1, point I |
| ligne 1 (I) — vote | Unanimité (non chiffré) | « L'assemblée considère » ; l'unanimité porte sur l'approbation des comptes | p. 1, point I |

### 24 juillet 1993 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 4 (VII) — resultat | Adoptée | Décision sans vote formel | p. 3, point VII |
| ligne 4 (VII) — vote | Non chiffré au PV | « L'assemblée donne mission au syndic » | p. 3, point VII |

### 30 juillet 1994 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 5 (VII) — sujet | Asphaltage et élargissement de la chaussée (demande de Mme Chevallay) à l'ordre du jour suivant | Demande de Mme Chevallay d'inscrire un projet d'asphaltage (élargissement) de la chaussée à l'ordre du jour suivant | p. 2, point VII |
| ligne 5 (VII) — resultat | Reportée | Demande (sans vote) | p. 2, point VII |

### 27 juillet 1996 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 3 (VI) — resultat | Reportée | Décision sans vote formel | p. 3, point VI |
| ligne 3 (VI) — vote | — | « Il sera présenté à l’ordre du jour de la prochaine assemblée » | p. 3, point VI |

### 28 juin 1997 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 2 (VI) — resultat | Reportée | Information (sans vote) | p. 2, point VI |

### 20 juin 1998 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 2 (VII) — sujet | Proposition du SIVOM : poste de refoulement, puis réseau séparatif avec 50 % de participation publique | Proposition du SIVOM entérinée : poste de refoulement d'ici 1999 (430 000 HT préfinancés, dont 50 % à la charge de la copropriété), puis réseau séparatif avec participation minimum de 50 % de la collectivité sur les canalisations communes | p. 2, point VII et lettre du SIVOM |

### 30 juin 2001 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 4 (11) — sujet | Sécurisation : un accès fermé, l'autre automatisé ; chiffrage pour 2002 | Sécurisation : chiffrage d'une barrière avec codeur et d'un portail classique à présenter en 2002 (souhait : un accès fermé, l'autre automatisé) — aucune fermeture décidée | p. 9, résolution 11 |

### 28 juin 2003 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 3 (8) — sujet | Remplacement des miroirs cassés par acier poli | Remplacement des 3 miroirs cassés par de l'acier poli | p. 4-5, point 8 |
| ligne 3 (8) — resultat | Non votée | Décision sans vote formel | p. 4-5, point 8 |
| ligne 3 (8) — vote | — | « Prévoir le remplacement » | p. 4-5, point 8 |
| ligne 4 (8) — sujet | Chiffrage d'une surveillance privée du lotissement | Chiffrage d'une surveillance privée, à présenter l'année suivante | point 8 |
| ligne 4 (8) — resultat | Reportée | Décision sans vote formel | point 8 |
| ligne 4 (8) — vote | — | — | point 8 |
| ligne 5 (8) — sujet | Commission des sages : composition et procédure arbres | Commission des sages : MM. Ryser, Mey et Mme Hirsch | point 8 |
| ligne 5 (8) — resultat | Adoptée | Décision sans vote formel | point 8 |
| ligne 5 (8) — vote | Non chiffré au PV | « Sont élus », sans formule de vote | point 8 |
| ligne 6 (8) — sujet | Incohérence du cahier des charges sur arbres hors zones | Arbres hors zones : projet d'avenant à préparer par la commission des sages | point 8 |
| ligne 6 (8) — resultat | Reportée | Décision sans vote formel | point 8 |
| ligne 6 (8) — vote | — | — | point 8 |
| ligne 7 (8) — sujet | Eaux pluviales : courrier commune et contrat d'entretien | Eaux pluviales : courrier à la commune et contrat d'entretien du réseau | point 8 |
| ligne 7 (8) — resultat | Non votée | Décision sans vote formel | point 8 |
| ligne 7 (8) — vote | — | — | point 8 |

### 26 juin 2004 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 1 (5) — sujet | Ligne travaux de 500 € au budget 2005/2006 | Budget prévisionnel 5 760 € : ligne travaux de 500 € annoncée pour 2005/2006 (phrase du budget, pas une résolution distincte) | résolution 5 (budget) |

### 18 juin 2005 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 2 (6.2) — resultat | Non votée | Sans objet | point 6.2 |

### 24 juin 2006 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 1 (1) — sujet | Appel d'offres assurance confié au conseil syndical | Appel d'offres « assurance » confié au conseil syndical (mention incluse dans l'approbation des comptes) | résolution 1 (comptes) |

### 30 juin 2007 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 1 (7) — sujet | Opportunité de fermer les portails du lotissement | Fermeture des portails : mandat au conseil syndical d'instruire un dossier, appel d'offres et AG spéciale demandée pour voter sur l'opportunité de fermer — la fermeture n'est pas décidée | p. 4, point 7 |
| ligne 1 (7) — vote | Pour 2 700 | Pour 2 700 / 5 100 · Contre : 7 copropriétaires nommés (non chiffré) | p. 4, point 7 |

### 28 juin 2008 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 1 (1) — sujet | Nettoyage du réseau d'eaux pluviales tous les trois ans | Nettoyage du réseau d'eaux pluviales tous les trois ans (mention incluse dans l'approbation des comptes) | p. 3, résolution 1 (comptes) |
| ligne 4 (9) — sujet | Fermeture du lotissement / sécurisation de la résidence | Fermeture du lotissement NON retenue : maintien de la situation actuelle (faute de garantie sur le ramassage des ordures) ; le portail peut être fermé manuellement | p. 5, point 9 |
| ligne 4 (9) — resultat | Adoptée | Décision sans vote formel | p. 5, point 9 |
| ligne 4 (9) — vote | Unanimité (non chiffré) | « L'assemblée générale décide unanimement le maintien de la situation actuelle » — aucune formule de vote ni décompte | p. 5, point 9 |
| ligne 7 (13) — resultat | Adoptée | Décision sans vote formel | p. 6, point 13 (divers) |
| ligne 7 (13) — vote | Non chiffré au PV | « Il est décidé » | p. 6, point 13 (divers) |

### 27 juin 2009 (AG (non précisé))

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne ajoutée (7) | — | Procédure Briefer : l'AG prend acte et entérine les actions menées — Décision sans vote formel | p. 6, point 7 |

### 3 juillet 2010 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 1 (10) — sujet | Procédure contre Mme Briefer : démarches entérinées (délibéré du TGI de Thonon en septembre 2010) | Procédure Briefer : l'AG prend acte et entérine les démarches (délibéré du TGI de Thonon attendu en septembre 2010) | p. 4, point 10 |
| ligne 1 (10) — resultat | Adoptée | Décision sans vote formel | p. 4, point 10 |
| ligne 1 (10) — vote | Non chiffré au PV | « en prend acte et entérine » | p. 4, point 10 |
| ligne 2 (11) — sujet | Stationnement sauvage à l'entrée côté village : intervention auprès de la commune | Stationnement sauvage à l'entrée côté village : le syndic interviendra auprès de la commune | p. 5, point 11 |
| ligne 2 (11) — resultat | Adoptée | Information (sans vote) | p. 5, point 11 |
| ligne 2 (11) — vote | Unanimité (non chiffré) | — | p. 5, point 11 |
| ligne 3 (11) — sujet | ORTEC : nettoyage des caniveaux lors du curage des canalisations | Demande à ORTEC de nettoyer les caniveaux à ciel ouvert lors du curage | p. 5, point 11 |
| ligne 3 (11) — resultat | Adoptée | Demande (sans vote) | p. 5, point 11 |
| ligne 3 (11) — vote | Unanimité (non chiffré) | — | p. 5, point 11 |

### 25 juin 2011 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 2 (10) — resultat | Reportée | Information (sans vote) | point 10 (divers, « Sans Vote ») |

### 29 juin 2013 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 3 (10) — resultat | Non votée | Sans objet | point 10 |

### 28 juin 2014 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne ajoutée (18) | — | Mandat au conseil syndical pour décider des portions d'enrobé à changer — Décision sans vote formel | p. 6, point 18 |

### 3 septembre 2016 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 2 (14) — resultat | Adoptée | Déclarée adoptée (majorité de l’art. 25 non atteinte) | point 14 |

### 18 septembre 2017 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 2 (11) — sujet | Cotisation fonds de travaux 2017/2018 | Cotisation fonds de travaux 2017/2018 (taux laissé en blanc au PV : « ……% ») | résolution 11 |
| ligne 3 (12) — vote | Pour 1 900 · Contre 0 | Pour 1 900 · Contre 0 · Abst. 100 (M. Devisle) | résolution 12 |
| ligne ajoutée (13) | — | SCI Violette : poursuite de l'action judiciaire si l'élagage ou l'abattage n'est pas fait au 30-11-2017 — Décision sans vote formel | p. 13, point 13 |

### 23 juin 2018 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 2 (12) — sujet | Canalisation EP entre propriétés MATHON et CHAPPUIS | Financement par le fonds de travaux de la reprise de la canalisation EP Mathon–Chappuis (5 830 € TTC, travaux validés en urgence par le conseil syndical) | p. 8, résolution 12 |

### 6 juillet 2019 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 4 (13) — sujet | Mandat au syndic : acte notarié des deux nouveaux lots | Mandat conditionnel au syndic (acte notarié des deux lots Leafe) si la division est possible après avis du CRIDON | résolution 13 |


### 19 novembre 2022 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 11 (14) — resultat | Reportée | Information (sans vote) | point 14 (questions diverses, « Sans Vote ») |

### 16 décembre 2023 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 11 (12.1) — resultat | Rejetée ou non prise en compte (voir note) | Vote non pris en compte (consultation juridique) | p. 14 (version notifiée par Foncia) |
| ligne 11 (12.1) — vote | Pour 1 500 · Contre 1 100 · Abst. 600 | Pour 1 500 · Contre 1 100 · Abst. 600 | p. 14 (version notifiée par Foncia) |

### 26 octobre 2024 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 1 (9) — sujet | Mandat à un avocat pour modifier le cahier des charges | Mandat à un avocat pour analyser le cahier des charges et étudier sa modification (10 000 € sur le fonds de travaux) | résolution 9 |
| ligne 2 (10) — sujet | Création d'un comité de sauvetage (cahier des charges) | Inscription de 32 propriétaires à un comité de sauvetage | point 10 |
| ligne 2 (10) — resultat | Non votée | Pas de vote (inscriptions individuelles) | point 10 |
| ligne 3 (11) — resultat | Non votée | Information (sans vote) | point 11 |


### 19 janvier 2026 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 1 (11) — resultat | Adoptée | Décision sans vote formel | résolution 11 |
| ligne 1 (11) — vote | Non chiffré au PV | « approuve le devis », « donne mandat » — aucun décompte | résolution 11 |

### 15 septembre 2026 (AGO)

| Élément | Avant | Après | Source |
|---|---|---|---|
| ligne 8 (15) — resultat | Adoptée | Décision sans vote formel | résolution 15 |
| ligne 8 (15) — vote | Non chiffré au PV | « demande », « décide », « autorise » — ni majorité ni décompte | résolution 15 |
| ligne 17 (28) — resultat | Adoptée | Décision sans vote formel | point 28 (conclusions) |
| ligne 17 (28) — vote | Non chiffré au PV | « Il est également décidé » | point 28 (conclusions) |

## Corrections de la synthèse générale (document `pv_archives_synthese`)

| Avant | Après | Source |
|---|---|---|
| puis, à partir de 2002, en tantièmes sur 5 100 à raison de 100 voix par lot. | puis, à partir de 2002, en voix sur 5 100 (100 par lot en général ; en 2002, le vote est encore exprimé en fraction, 15/44). | PV 2002 p. 1 et 6 |
| En 1988, l'assemblée devait décider du maintien des règles propres au lotissement à la suite de la loi du 6 janvier 1986, mais la page du PV qui relate ce vote manque. | En 1988, l'assemblée devait se prononcer sur le maintien des règles propres au lotissement (loi du 6 janvier 1986), mais seule la première page du PV est conservée : on ignore s'il y a eu vote et quel en fut le résultat. | fichier 1988, p. 19 |
| En 2024, l'assemblée mandate un avocat pour réécrire le cahier des charges et un comité de sauvetage se constitue. | En 2024, l'assemblée mandate un avocat pour analyser le cahier des charges et étudier sa modification (10 000 €), et 32 propriétaires s'inscrivent à un comité de sauvetage. | PV 2024, rés. 9 et point 10 |
| L'AGE du 19 juin 2025 adopte l'addendum III et la clé de superficie. | L'AGE du 19 juin 2025 adopte l'addendum III au cahier des charges, qui institue la clé de superficie (le texte de l'addendum n'est pas reproduit au PV). | PV AGE 2025 rés. 4 ; addendum III |
| ['26 octobre 2024','Mandat à un avocat pour modifier le cahier des charges (10 000 €)','Adoptée à l’unanimité'] | ['26 octobre 2024','Mandat à un avocat pour analyser le cahier des charges et étudier sa modification (10 000 €)','Adoptée à l’unanimité (3 400/3 400)'] | PV 2024, rés. 9 |
| ['19 juin 2025','Addendum III au cahier des charges','Adoptée (36 membres sur 50, 74 081 m²)'] | ['19 juin 2025','Addendum III au cahier des charges et élection du conseil syndical','Adoptée (36 membres sur 50, 74 081 tantièmes-m² sur 104 646)'] | PV AGE 2025 rés. 4 |
| ['15 septembre 2026','Statuts de l’ASL','Adoptée (36 colotis sur 50, 75 540 m²)'] | ['15 septembre 2026','Statuts de l’ASL','Adoptée (75 540 m² pour, 16 606 contre, sur 104 646 ; 8 votants contre nommés)'] | PV 15/09/2026 p. 8 (le « 36 sur 50 » figure à la rés. 13) |
| En 1992, l'assemblée maintient au lot Zwollsman le tiers de charges supplémentaire prévu par le règlement du lotissement. | En 1992, l'assemblée considère, sans vote distinct, que le tiers de charges supplémentaire du lot Zwollsman doit lui rester imputé, conformément au règlement du lotissement. | PV 1992 p. 1 |
| ['25 juillet 1992','Tiers supplémentaire de charges maintenu au lot Zwollsman','Adoptée à l’unanimité'] | ['25 juillet 1992','Tiers supplémentaire de charges maintenu au lot Zwollsman','Décision sans vote formel (« l’assemblée considère »), comptes approuvés à l’unanimité'] | PV 1992 p. 1 |
| ['19 juin 2025','Clé de superficie (addendum III)','Adoptée'] | ['19 juin 2025','Clé de superficie (addendum III, texte non reproduit au PV)','Adoptée avec l’addendum'] | PV AGE 2025 ; addendum III |
| En 1989, M. Le Corre attaque en justice la décision de poser une barrière à l'entrée ; le syndicat se défend. Après des cambriolages, l'assemblée de 2001 souhaite qu'un accès soit fermé en permanence et l'autre automatisé, mais en 2002 | En 1989, l'assemblée prend connaissance de l'assignation de M. Le Corre contre la décision de poser une barrière à l'entrée et des conclusions du syndicat. Après des cambriolages, l'assemblée de 2001 juge souhaitable qu'un accès soit fermé en permanence et l'autre automatisé et demande un chiffrage pour 2002, sans décider de fermeture ; en 2002 | PV 1989 p. 2 ; PV 2001 p. 9 |
| en 2003, l'assemblée refuse les portails automatiques et pose deux portails manuels. En 2007, elle demande d'instruire une fermeture ; en 2008, elle y renonce, faute de garantie sur le ramassage des ordures. Le portail côté Nernier est réparé en 2012. | en 2003, l'assemblée refuse les portails automatiques et décide la pose de deux portails manuels, ouverts jour et nuit (6 600 € TTC). En 2007, elle mandate le conseil syndical pour instruire un dossier et demande une AG spéciale pour se prononcer sur l'opportunité de fermer les deux portails (2 700/5 100) : la fermeture n'est pas décidée. En 2008, le point 9 n'est pas mis aux voix : le PV relate que l'assemblée « décide unanimement le maintien de la situation actuelle », faute de garantie sur le ramassage des ordures ; le lotissement n'est pas fermé. La réparation du portail côté Nernier est décidée en 2012 (960 € TTC). | PV 2003, 2007 p. 4, 2008 p. 5, 2012 |
| L'automatisation revient en 2020 et échoue de peu (700 pour, 900 contre). | La remise en fonction des portails, avec interphone, est rejetée en 2020 (700 pour, 900 contre, 300 abstentions). | PV 2020, rés. 12.1 |
| En janvier 2026, elle est confirmée sur la nouvelle clé et l'enveloppe est portée à 70 000 € pour un portail coulissant industriel. | En janvier 2026, elle est confirmée sur la nouvelle clé et le conseil syndical reçoit délégation pour choisir le prestataire dans la limite de 70 000 € TTC ; le portail coulissant industriel n'est qu'une orientation présentée en préambule, sans vote. | PV 19/01/2026, rés. 15 |
| ['1er juillet 1989','Défense contre l’action de M. Le Corre visant la barrière d’entrée','Adoptée à l’unanimité'] | ['1er juillet 1989','Action de M. Le Corre contre la barrière d’entrée : lecture de l’assignation et des conclusions du syndicat','Résolution adoptée à l’unanimité'] | PV 1989 p. 2 |
| ['30 juin 2001','Un accès fermé, l’autre automatisé : chiffrage pour 2002','Adoptée à l’unanimité'] | ['30 juin 2001','Chiffrage d’une barrière à codeur et d’un portail pour 2002 (fermeture souhaitée, non décidée)','Adoptée à l’unanimité'] | PV 2001 p. 9 |
| ['30 juin 2007','Instruction de la fermeture des portails','Adoptée (2 700/5 100)'] | ['30 juin 2007','Mandat d’instruire un dossier et demande d’une AG spéciale sur l’opportunité de fermer (fermeture non décidée)','Adoptée (2 700/5 100)'] | PV 2007 p. 4 |
| ['28 juin 2008','Fermeture du lotissement','Abandonnée à l’unanimité'] | ['28 juin 2008','Fermeture du lotissement non retenue : maintien de la situation actuelle','Sans vote formel (« décide unanimement », aucun décompte)'] | PV 2008 p. 5 |
| ['16 décembre 2023','Remise en fonction des portails, mandat de 50 000 €','Adoptée (2 081 pour, 1 119 contre)'] | ['16 décembre 2023','Remise en fonction des portails ; mandat de 50 000 € au conseil syndical','Adoptées (principe : 2 081 pour, 1 119 contre ; mandat : 2 381 pour, 819 contre)'] | PV 2023 rés. 10.1 et 10.3 |
| L'enrobé est refait en 2013-2015, en partie grâce aux participations de propriétaires responsables de dégâts. | Pour l'enrobé de l'entrée, une réfection partielle est décidée en 2013 avec une participation de M. Naujoks (3 300 €), puis le conseil syndical reçoit mandat en 2014 pour choisir les portions à refaire ; les travaux sont relatés en 2015. | PV 2013, 2014 (point 18), 2015 |
| ['16 décembre 2023','Rond-point au bas de l’allée des Précettes','1 500 pour, 1 100 contre : rejetée ou non prise en compte selon la version du PV'] | ['16 décembre 2023','Rond-point au bas de l’allée des Précettes','1 500 pour, 1 100 contre, 600 abst. : vote non pris en compte (consultation juridique sur la majorité) ; une autre version du PV, absente du dossier, indiquait « rejetée »'] | PV 2023 p. 14 |
| et refuse un raccordement extérieur au réseau du lotissement. | et refuse le raccordement de M. J. Francillon au réseau du lotissement. | PV 1991 |
| en 1998, elle entérine la proposition du SIVOM (poste de refoulement, puis réseau séparatif financé à 50 % par la collectivité), dont les travaux sont faits en 2000-2001. Un réseau d'eau pour la protection incendie est créé en 1991 (95 000 F) et complété d'une bouche en 1992. | en 1998, elle entérine la proposition du SIVOM : poste de refoulement (phase 1 de 430 000 HT préfinancés, dont 50 % à la charge de la copropriété), puis réseau séparatif avec une participation minimum de 50 % de la collectivité sur les canalisations communes ; une première tranche est réalisée à l'automne et l'hiver 2000-2001, la seconde restant à programmer en juin 2001. Un réseau d'eau pour la protection incendie est décidé en 1991 (95 000 F) ; en 1992, une bouche d'incendie devenue inefficace est remplacée (15 000 F). | PV 1998 et lettre SIVOM ; PV 2001 ; PV 1991-1992 |
| Une réparation urgente est faite en 2018 entre les propriétés Mathon et Chappuis. | En 2018, la reprise de la canalisation entre les propriétés Mathon et Chappuis, validée en urgence par le conseil syndical (entreprise Favre 4, 5 830 € TTC), est financée sur le fonds de travaux. | PV 2018 p. 8 |
| En septembre 2026, le président indique un ordre de grandeur de 350 000 à 500 000 €, qui n'est pas un budget. | En septembre 2026, le président rappelle qu'un expert a évoqué environ 350 000 € pour la réfection du réseau d'eaux pluviales et un montant total possible d'environ 500 000 €, montants qui ne constituent pas un budget. | PV 15/09/2026 |
| ['29 juin 2013','Demande au SIVOM de réparer la canalisation endommagée','Adoptée à l’unanimité'] | ['29 juin 2013','Courrier recommandé au SIVOM pour la prise en charge de la réparation de la canalisation (dans l’approbation des comptes)','Adoptée à l’unanimité'] | PV 2013 rés. 4 |
| ['23 juin 2018','Reprise de la canalisation Mathon–Chappuis (5 830 €)','Adoptée à l’unanimité'] | ['23 juin 2018','Financement sur le fonds de travaux de la reprise de la canalisation Mathon–Chappuis (5 830 € TTC, validée en urgence par le conseil syndical)','Adoptée à l’unanimité'] | PV 2018 p. 8 |
| ['19 janvier 2026','Global Partner maître d’œuvre (21 120 €, mandat 35 000 €)','Adoptée (sans décompte au PV)'] | ['19 janvier 2026','Global Partner maître d’œuvre (21 120 €, mandat 35 000 €)','Décision sans vote formel (« approuve le devis », « donne mandat »), sans décompte'] | PV 19/01/2026 rés. 11 |
| (2001, 2002, 2007, 2008, 2021) | (2001, 2007, 2008, 2021 ; inscrit à l'ordre du jour en 2002 sans décision) | PV 2002 |
| ['19 juin 2025','Budget de réhabilitation de 20 159,90 €','Adoptée (81 584 m² pour, 6 691 contre)'] | ['19 juin 2025','Confirmation du budget de réhabilitation de 20 159,90 €','Adoptée (81 584 m² pour, 6 691 contre, 2 412 abst.)'] | PV AGE 2025 rés. 8 |
| Les rappels sont constants dès 1992 (vue sur le lac, peupliers) ; en 1993, un ingénieur de la DDA examine les grands arbres et une mise en demeure est décidée. | Les rappels sont constants dès 1990 (vue sur le lac en 1992, peupliers en 1992 et 1998) ; en 1993, un ingénieur de la DDA examine les grands arbres et l'assemblée donne mission au syndic de mettre un propriétaire en demeure, sans vote formel. | PV 1990, 1992, 1993, 1998 |
| un contentieux en appel à Chambéry aboutit à une astreinte qui pèse sur plusieurs résidents, rappelée de 2007 à 2009. | un jugement de la cour d'appel de Chambéry (cité en 2003) et un jugement du TGI de Thonon du 12 mai 2005 (rappelé en 2007) fondent une astreinte qui pèse sur plusieurs résidents, rappelée de 2007 à 2009. | PV 2003 ; PV 2007 p. 4 |
| ['24 juillet 1993','Mise en demeure pour la hauteur des arbres','Adoptée'] | ['24 juillet 1993','Mise en demeure de M. Reistad pour la hauteur des arbres','Décision sans vote formel (« donne mission au syndic »)'] | PV 1993 p. 3 |
| Le lotissement s'est défendu contre M. Le Corre, qui contestait la barrière d'entrée (1989), et a obtenu en 1993 le mandat de faire vendre judiciairement le lot d'un débiteur condamné par le TGI de Thonon ; en 1994, le lot ayant été vendu sans que le syndicat soit payé, les créanciers prioritaires ayant absorbé le prix, l'hypothèque légale est levée. | En 1989, l'assemblée prend connaissance de l'assignation de M. Le Corre, qui contestait la barrière d'entrée, et des conclusions du syndicat. En 1993, elle donne mandat au syndic de faire procéder si nécessaire à la vente judiciaire du lot de M. Cartegini, condamné par le TGI de Thonon le 17 mai 1993 ; en 1994, le lot ayant été vendu sans que le syndicat soit payé, les créanciers prioritaires ayant absorbé le prix, elle donne mandat au syndic de signer la mainlevée de l'hypothèque légale. | PV 1989, 1993, 1994 |
| Il a été en défense contre Mme Briefer en 2009 ; l'affaire est mise en délibéré en septembre 2010. | Il a été en défense contre Mme Briefer : en 2009 et 2010, l'assemblée prend acte et entérine les démarches, sans vote formel ; l'affaire, plaidée, est mise en délibéré par le TGI de Thonon pour septembre 2010. | PV 2009 p. 6 ; PV 2010 p. 4 |
| Depuis 2026, le recouvrement des impayés est encadré par les résolutions 13 et 14. | Depuis l'AGO du 15 septembre 2026, le recouvrement des impayés est encadré par les résolutions 13 et 14 (article XX adopté, sans validation formelle de Me Garnier et restant à intégrer aux statuts). | PV 15/09/2026 |
| ['1er juillet 1989','Défense contre l’action de M. Le Corre (Me Yves Redon)','Adoptée à l’unanimité'] | ['1er juillet 1989','Action de M. Le Corre : lecture de l’assignation et des conclusions du syndicat (Me Yves Redon)','Résolution adoptée à l’unanimité'] | PV 1989 p. 2 |
| ['3 juillet 2010','Procédure Briefer : démarches entérinées','Adoptée'] | ['3 juillet 2010','Procédure Briefer : l’assemblée prend acte et entérine les démarches (délibéré attendu en septembre 2010)','Décision sans vote formel'] | PV 2010 p. 4 |
| Celle de 10 000 € votée en 2016 est remboursée dès 2017. Le fonds de travaux obligatoire apparaît en 2017 (5 000 €), puis monte à 10 000 € (2020), 20 600 € (2021) et 50 000 € par an à partir de 2022, avec un objectif de 250 000 €. | Celle de 10 000 € déclarée adoptée en 2016 (majorité de l'article 25 non atteinte) est remboursée dès 2017. Le fonds de travaux obligatoire est voté pour la première fois en 2017 (taux 2017-2018 laissé en blanc au PV, puis 5 000 € par an à partir de 2018-2019) ; la cotisation est fixée à 10 000 € en 2018, ramenée à 525 € en 2019, portée à 10 000 € en 2020 et à 20 600 € en 2021, puis à 50 000 € pour 2023-2024 (2022, avec un objectif de 250 000 €) et pour 2024-2025 (2023). | PV 2016 à 2023 |
| ['18 septembre 2017','Remboursement de la provision ; fonds de travaux à 5 000 €','Adoptée'] | ['18 septembre 2017','Remboursement de la provision au 1er octobre 2017 ; fonds de travaux (taux 2017-2018 en blanc, 5 000 €/an à partir de 2018-2019)','Adoptées (2e lecture, art. 24)'] | PV 2017 |
| puis tolérés en 1995 jusqu'à l'élargissement de la voie à 4 m, sous réserve d'assurance ; | puis tolérés en 1995 (22/50 pour, 8/50 contre) jusqu'à l'élargissement de la voie à 4 m, la situation étant par ailleurs déclarée aux assureurs ; | PV 1995 |
| Elle autorise ponctuellement des aménagements aux frais du demandeur : panneaux municipaux (2004), boute-roue | Elle autorise ponctuellement des aménagements : panneaux d'affichage de la mairie (2004), puis, aux frais du demandeur, boute-roue | PV 2004 |
| Depuis septembre 2026, la demande de distraction des sept colotis de la zone C est inscrite à l'ordre du jour de l'AG du 14 septembre 2027. | En septembre 2026, l'assemblée prend acte de la déclaration commune des sept colotis de la zone C demandant leur distraction, qui doit être inscrite à l'ordre du jour de l'AG du 14 septembre 2027 ; aucune décision n'est prise. | PV 15/09/2026 |
| ['15 septembre 2026','Demande de distraction de la zone C','Inscrite à l’AG de 2027'] | ['15 septembre 2026','Déclaration commune des colotis de la zone C (demande de distraction)','Prise d’acte, sans décision ; à inscrire à l’AG de 2027'] | PV 15/09/2026 |

## Pour mémoire — corrections du registre Word (hors application)

118 corrections ont été portées au registre `Registre_decisions_AG_Rives_1988-2026` (qualification des résultats, noms, chiffres, notes de lecture). Elles ne concernent pas la base de l'application ; le détail complet (avant, après, source) est dans `1_AG/_travail_registre_2026-09-28/revalidation_2026-09-30/journal_corrections.json`.

## Points restés en doute (à ne pas « corriger » sans pièce)

- **2023, résolution 12.1 (rond-point)** : la version du PV notifiée par Foncia, seule présente dans le dossier, dit « vote non pris en compte » ; une autre version (Foncia Maison de l'Immobilier), lue le 28 septembre et absente depuis, disait « rejetée ». L'application retient « Vote non pris en compte » et mentionne l'autre version en note.
- **1988** : le fichier est pour l'essentiel la convocation ; seule la première page du PV (p. 19) est conservée. Le vote sur la loi de 1986 est inconnu.
- **1990** : la page « suite n° 1 » du PV manque (points IV à VII).
- **2025-06 et 2026** : les PV comptent en « tantièmes » ; il s'agit des m² de superficie (addendum III), le PV ne l'écrit pas.
