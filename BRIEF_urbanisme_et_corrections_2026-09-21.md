# Brief n° 2 — Urbanisme et servitudes, et corrections de l'import du 21 septembre

> Destinataire : Claude Code, sur le dépôt `CS_Rives`.
> Source : lecture intégrale du cahier des charges de 1955, de l'additif du 10 février 1956
> (OCR), de l'additif de 1957, de l'Addendum III du 19 juin 2025, de l'arrêté préfectoral
> du 5 mai 1961 et de la lettre du maire de 1961 (OCR), du règlement et du plan de zonage
> du PLU de 2013 (historique) et du PLUi-HM de Thonon Agglomération approuvé le 16 décembre 2025
> (règlement écrit et règlement graphique de Nernier). Date : 21 septembre 2026.

> **Mise à jour du 21 septembre (PLUi-HM).** Ce brief a déjà été exécuté (rapports
> `export/brief_urbanisme_et_corrections_2026-09-21_2026-09-21T11-0*.md`). Ne rejoue que la mise à jour
> PLUi-HM : remplace le contenu du sujet « Urbanisme et servitudes » par la section 1.2, corrige le
> contenu de l'entrée du 22 avril 2013, ajoute l'entrée du 16 décembre 2025 avec ses pièces
> et déplace sur elle la pièce `PLU/code civil art 671.png` si elle est ailleurs.
> Deux corrections en plus : dans l'entrée du 10 février 1956 (Urbanisme et servitudes), remplace
> « E4 à E8 » par « E1 à E8 » (l'additif crée les lots E1 à E8, erreur de lecture de ma part) ; l'entrée
> « Modifications parcellaires Luscher / Van Den Berg » du 21 février 1961 EST l'arrêté préfectoral
> n° 5835-61 (vérifié sur la pièce) : renomme-la « Arrêté préfectoral n° 5835-61 — modification
> parcellaire (lots E, Luscher / Van Den Berg) », ne crée pas de doublon. Rien d'autre.

---

## 0. Méthode

Même mécanique que le premier import : **données dans un fichier séparé**
(`scripts/data/urbanisme_et_corrections_2026-09-21.mjs`), mode essai par défaut, écriture
avec `--go`, sauvegarde du jour exigée, idempotence, rapport dans `export/`.
Réutilise `import_memoire.mjs` et `corriger_memoire.mjs` plutôt que d'écrire un troisième script,
si leur mécanique le permet.

Deux leçons du premier passage s'appliquent ici :

- **Écris dans les sujets existants, sous leur titre réel.** Le sujet « Biens communs et
  indivision » s'appelle « Biens communs et indivis » dans la base.
- **Les pièces vont sur l'entrée qu'elles prouvent**, pas sur le sujet. Vérifie l'existence
  d'une pièce au niveau du sujet ET de ses entrées avant de l'attacher.

**Dates** : la sentinelle `1999-09-09` reste la règle pour ce qui n'est pas daté. Ce brief
remplace plusieurs sentinelles par des dates désormais établies par les actes eux-mêmes.

**Le contenu des sujets est du HTML** (RichTextEditor) : convertis les paragraphes et listes
ci-dessous en `<p>`, `<strong>`, `<ul><li>` comme le fait l'éditeur, sans styles en ligne.

---

## 1. Sujet « Urbanisme et servitudes » — synthèse complète

Le sujet existe, avec trois entrées en date sentinelle. **Remplace son résumé et son contenu**,
**conserve** ses trois entrées existantes, **ajoute** les entrées de la section 1.3.

### 1.1 Résumé

> Servitudes perpétuelles du cahier des charges — constructions, plantations, clôtures, réseaux, passages — et règles d'urbanisme applicables au lotissement.

### 1.2 Contenu (synthèse)

Deux ordres de règles s'appliquent au lotissement, et ils ne se confondent pas. Les servitudes du cahier des charges relèvent du droit privé : elles lient les colotis entre eux, à perpétuité, et sont opposables à tout acquéreur puisque les actes ont été publiés au fichier immobilier. Les règles d'urbanisme relèvent du droit public : elles changent avec le document d'urbanisme et s'imposent à toute demande d'autorisation. Les deux s'appliquent ensemble ; en pratique, c'est la plus stricte qui fixe ce qu'on peut faire.

**Servitudes du cahier des charges**

- **Destination** (art. 13, 1955) : habitation bourgeoise. L'exploitation d'un commerce et les colonies de vacances sont interdites, à titre de servitude perpétuelle et réciproque.
- **Non aedificandi** (art. 14, 1955) : 15 m libres de toute construction depuis les rives du Léman ; 5 m depuis les voies d'accès ; 15 m entre deux constructions d'un même lot ; recul d'au moins 3 m des limites séparatives, et d'au moins la moitié de la hauteur de corniche ; en zone A, hauteur maximale de 10 m à moins de 40 m des rives, 8 m au-delà. Tout morcellement ultérieur d'un lot est soumis à approbation préfectorale.
- **Plantations** (art. 15, dans sa rédaction issue de l'additif du 10 février 1956) : en zones A et B, sauf les lots B1 et B2, arbres de 7 m au plus le long des limites séparatives, sur une bande de 5 m de large et sur 40 m au plus depuis le lac (zone A) ou depuis le chemin d'accès (zone B) ; lots D1 à D6, bande de 5 m le long des limites perpendiculaires au lac, 7 m au plus ; lots B1, B2 et zone E, aux seuls emplacements prévus au plan de masse. La zone C et les lots D7, D8, E7 et E8 ne sont soumis à aucune restriction. Cet article fonde les contentieux SCI Violette et SCI Villa Aysha.
- **Clôtures** (art. 12, 1955) : grille de 1,50 m, ou mur bahut de 0,50 m au plus surmonté d'une grille, le tout ne dépassant pas 1,50 m, ou haie vive.
- **Réseaux** : aisance de 3 m de part et d'autre des collecteurs d'eau et d'égout sur l'ensemble du lotissement (additif de 1956) ; servitude perpétuelle et irrévocable d'accès, sans indemnité, au profit du lotissement sur les parcelles où passent les canalisations d'eaux pluviales biens communs, après préavis écrit de trente jours sauf urgence (Addendum III, art. 4, 19 juin 2025) ; obligation pour les riverains de supporter sans indemnité les signes indicateurs et les fils télégraphiques, téléphoniques et électriques sur leurs clôtures et constructions (art. 9-10°, 1955).
- **Usage de la voie** (art. 5 et 9, 1955) : la voie est affectée à perpétuité à la circulation entre acquéreurs et reste « absolument privée » tant qu'elle n'est pas classée. Les dégradations causées par des travaux sont à la charge de l'acquéreur responsable ; faute de remise en état dans le mois suivant une sommation, le syndicat peut y faire procéder à ses frais.

**Passages et plages**

Les actes connaissent deux plages. La **plage commune**, créée par l'additif de 1956 le long de la limite ouest du lotissement, est un bien commun ; l'Addendum III du 19 juin 2025 l'a rangée parmi les biens indivis de tous les colotis. La **plage communale**, sur le lot n° 13, devait être cédée gratuitement à la commune pour servir aux acquéreurs comme aux habitants de Nernier : l'arrêté préfectoral du 5 mai 1961 impose cette cession et un droit de passage au profit des usagers de cette plage sur la partie de la voie reliant le lot n° 13 à la route de Messery. Le cahier des charges de 1955 accordait en outre un droit de passage à MM. Charles et Clet, riverains à l'est du lot n° 13, sur la même portion de voie.

Le lotissement n'est donc pas entièrement fermé au public en droit. Deux points restent à établir : si la cession de la plage communale a été réalisée par acte, et quelle suite a été donnée au recours gracieux formé par Mme de Leusse contre l'arrêté de 1961.

**Règles d'urbanisme**

Le document en vigueur est le **PLUi-HM de Thonon Agglomération**, approuvé par délibération du conseil communautaire du 16 décembre 2025 (DEL_CC2025_00312). Sur le règlement graphique de Nernier, le lotissement relève de deux zones :

- les **lots riverains du lac**, le long de l'allée de Rives (parcelles 0196 à 0212 environ), sont en **zone NL** — zone naturelle littorale, bande des 100 m de la loi Littoral dans ses parties considérées comme non urbanisées. Les habitations existantes d'au moins 50 m² de surface de plancher peuvent y être refaites, réhabilitées et aménagées, sans modification de volume ; les annexes existantes peuvent être réhabilitées, sans modification de volume. Hauteur maximale 7 m, emprise au sol 0,20 au plus ;
- les **lots intérieurs**, entre l'allée de Rives et la route de Messery (Champ Catin), sont en **zone UCp** — centralité des villages avec enjeux paysagers. Hauteur maximale des constructions principales 7 m, ou 6 m en toiture-terrasse ; emprise au sol 0,25 au plus ; 55 % d'espaces perméables, dont 35 % du tènement en pleine terre ; un arbre de haute tige pour 100 m² de pleine terre ; recul d'au moins 3 m des limites séparatives, et d'au moins la moitié de la différence d'altitude.

**Clôtures et haies** (art. UC.II.4.c-d et N II.4.c-d, rédaction identique pour l'essentiel) :

- les clôtures ne sont pas obligatoires ; leur édification est soumise à déclaration préalable ;
- **hauteur maximale 1,60 m**, sur le domaine public comme en limite séparative ;
- composition : soit une clôture à claire-voie (lattes, grilles, grillages) ajourée à 20 % au moins, doublée ou non d'une haie, sur un mur bahut de 0,60 m au plus ; soit **une haie végétalisée d'essences locales et variées**. Une palissade opaque n'est admise en limite séparative qu'entre constructions mitoyennes, sur 5 m au plus de part et d'autre. Canisses, brandes, bâches, films et toiles sont interdits ;
- **la haie qui tient lieu de clôture est donc limitée à 1,60 m.** Le règlement ne fixe pas de hauteur propre aux haies plantées à l'intérieur du terrain ;
- les **haies monovégétales disposées en mur rideau** sur le pourtour des limites parcellaires sont interdites (fin des haies de thuyas ou de laurier en continu) ; renvoi à l'OAP « Biodiversité et continuités écologiques » ;
- **en zone NL**, les clôtures doivent en outre laisser passer la petite faune : un passage libre d'au moins 20 cm de haut sur 30 cm de large, tous les 5 m au plus ; le mur bahut n'y est admis que pour prolonger un mur bahut existant ;
- portails : 1,80 m au plus ;
- la restauration ou la reconstruction d'une clôture existante peut conserver la hauteur de l'existant, même supérieure.

Ces règles se cumulent avec le cahier des charges (clôture à grille de 1,50 m au plus, art. 12) et avec le Code civil : une plantation de plus de 2 m doit être à 2 m au moins de la limite, une plantation plus basse à 0,50 m (art. 671). La règle la plus stricte s'applique : 1,50 m pour une grille, 1,60 m pour une haie de clôture.

Le plan porte aussi un emplacement réservé n° 534 sur la route de Messery, au droit de l'entrée du lotissement ; son objet est à vérifier dans la liste des emplacements réservés, qui ne figure pas dans le dossier.

*Historique.* Le PLU communal de 2013 (révision n° 2, approuvée le 22 avril 2013) classait les lots riverains en zone UCh, leur frange littorale en zone Nl et les lots intérieurs en zone UC ; il limitait les haies à 2 m et prévoyait les emplacements réservés n° 4 (accès piéton au lac à l'entrée du lotissement) et n° 15 bis (élargissement de la route de Messery). Il a été remplacé par le PLUi du Bas-Chablais, puis par le PLUi-HM.

### 1.3 Entrées à ajouter

| date_evenement | titre | contenu | pièce |
|---|---|---|---|
| 1955-08-22 | Arrêté préfectoral n° 3164-55 autorisant le lotissement de Rives | 43 lots sur environ 10 ha, section B n° 122, 123, 129 et 130, au lieu-dit Rives. Le cahier des charges, déposé chez Me André Naz le 5 septembre 1955, fixe les servitudes de destination, de non aedificandi, de clôture et de plantation, et l'usage privé de la voie. | `4_ASL/3-cahier des charges/1955 août-cahier des charges.pdf` |
| 1956-02-10 | Arrêté préfectoral — extension et premier additif | Extension au lieu-dit Champ Catin, lots A14 à A16 et E1 à E8. L'additif remplace l'article 15 sur les plantations, institue une aisance de 3 m de part et d'autre des collecteurs d'eau et d'égout, et crée la plage commune le long de la limite ouest. Acte de dépôt chez Me Naz le 26 mars 1956, transcrit le 8 mai 1956, volume 612 n° 55. | fichier de l'annexe I de 1956 dans `4_ASL/3-cahier des charges/` (nom réel : `1956 février-Annexe I (plage).pdf`) |
| 1961-02-21 | Arrêté préfectoral — modification du plan parcellaire | Modification du plan parcellaire du lotissement, visée par l'arrêté du 5 mai 1961. | — |
| 1961-05-05 | Arrêté préfectoral — cession de la plage communale et droit de passage | À la demande du maire de Nernier, l'article 5 de l'arrêté de 1955 est remplacé : le lotisseur cède gratuitement à la commune une partie du lot n° 13 — un carré de 20 m sur 20 m au bord du lac et un couloir d'accès de 3 m côté levant —, à condition qu'elle serve exclusivement de plage aux acquéreurs du lotissement comme aux habitants de Nernier. Le lotisseur et ses acquéreurs doivent consentir aux usagers de cette plage un droit de passage sur la partie de la voie reliant le lot n° 13 à la route de Messery. Arrêté publié au bureau des hypothèques. | `4_ASL/2-documents mairie/cession de la plage.pdf` |
| 1999-09-09 | Lettre du maire au sous-préfet sur le recours de Mme de Leusse | Mme de Leusse a formé un recours gracieux contre l'arrêté du 5 mai 1961. Le maire rapporte que les acquéreurs préfèrent entretenir leurs routes pour conserver au lotissement son caractère privé, et refuse d'abandonner la propriété du chemin d'accès à la plage contre un simple droit de passage. Lettre postérieure au 11 juillet 1961. ⚠ Date exacte à renseigner ; suite donnée au recours inconnue. | `4_ASL/2-documents mairie/1961 - Décision des colotis de garder les allées privées.pdf` |
| 2013-04-22 | Approbation de la révision n° 2 du PLU de Nernier | Classement du lotissement en zones UCh, UC et Nl ; emplacements réservés n° 4 (accès piéton au lac à l'entrée du lotissement) et n° 15 bis (élargissement de la route de Messery). Document abrogé : remplacé par le PLUi du Bas-Chablais, puis par le PLUi-HM (entrée du 16 décembre 2025). | `PLU/reglement PLU.pdf` et `PLU/plan_zonage.pdf` |
| 2025-12-16 | Approbation du PLUi-HM de Thonon Agglomération | Délibération DEL_CC2025_00312. Lots riverains du lac en zone NL (naturelle littorale, bande des 100 m), lots intérieurs en zone UCp. Clôtures soumises à déclaration préalable, 1,60 m au plus, à claire-voie ou en haie d'essences locales et variées ; haies monovégétales en mur rideau interdites ; en NL, passages pour la petite faune ; portails 1,80 m. Emplacement réservé n° 534 sur la route de Messery, objet à vérifier. | `PLU/PLU 2026/0_Actes administratifs/DEL_CC2025_00312_Approbation_PLUiHM.pdf`, `PLU/PLU 2026/3_REGLEMENT/200067551_reglement_20251216.pdf` et `PLU/PLU 2026/3_REGLEMENT/Règlement graphique/200067551_reglement_graphique_38_nernier_2500_20251216.pdf` |
| 2025-06-19 | Addendum III, article 4 — servitude d'accès aux réseaux d'eaux pluviales | Les propriétaires des parcelles où passent ou doivent passer les canalisations d'eaux pluviales biens communs consentent au profit du lotissement une servitude perpétuelle et irrévocable d'accès, sans indemnité, pour leur réalisation, leur entretien et leur réparation. Préavis écrit de trente jours avant travaux, sauf urgence ; remise en état à la charge du lotissement. | — |

La pièce `PLU/code civil art 671.png` (distances de plantation) va sur l'entrée du 16 décembre 2025, avec les pièces du PLUi-HM.

**Si le brief n° 2 a déjà été exécuté** : remplace seulement le contenu du sujet par la section 1.2 ci-dessus, corrige le contenu de l'entrée du 22 avril 2013 et ajoute l'entrée du 16 décembre 2025. Ne touche à rien d'autre.

---

## 2. Corrections dans « Biens communs et indivis »

Trois entrées de l'import sont **fausses ou incomplètes**. Les actes que je n'avais pas lus au
moment du premier brief les datent et les corrigent.

| Entrée actuelle | Correction |
|---|---|
| « Cahier des charges du lotissement de Rives (août 1955) », date sentinelle | Date **1955-08-22**. Ajouter au contenu : « Arrêté préfectoral n° 3164-55 du 22 août 1955 ; cahier des charges déposé chez Me André Naz le 5 septembre 1955. » |
| « Annexe I — arbres et plage (février 1956) », date sentinelle | Date **1956-02-10**. Titre : « Premier additif — extension, plantations et plage commune ». Contenu : « Arrêté préfectoral du 10 février 1956. L'additif remplace l'article 15 sur les plantations, institue une aisance de 3 m autour des collecteurs, et crée une plage commune le long de la limite ouest, appartenant indivisément aux lots qui n'ont pas d'accès privé au lac, au prorata de leur superficie, avec les frais d'entretien à leur charge. Cette règle de propriété et de charge a été remplacée par l'Addendum III du 19 juin 2025. » |
| « Décision des colotis de garder les allées privées (vers 1961) », date sentinelle | **Le titre est faux.** La pièce ainsi nommée est une lettre du maire au sous-préfet, pas une décision des colotis. **Remplacer** par : date **1961-05-05**, titre « Arrêté préfectoral — cession de la plage communale et droit de passage », contenu identique à l'entrée du même nom en section 1.3, suivi de : « La pièce classée sous le nom « 1961 - Décision des colotis de garder les allées privées » est une lettre du maire au sous-préfet : elle rapporte la préférence des acquéreurs pour le caractère privé du lotissement, elle ne constitue pas une décision des colotis. L'article L.318-3 du code de l'urbanisme ne permet le transfert d'office que d'une voie ouverte à la circulation publique : le droit de passage de 1961 au profit des usagers de la plage communale est le point à examiner à cet égard. » |

Et **compléter** l'entrée du 15 janvier 1957 (acte de dépôt Me Naz) en fin de contenu :
« Cet article 4 prévoyait aussi que le droit de propriété des acquéreurs sur le sol de la rue
cesserait le jour où la commune classerait la rue comme voie publique. Il a été remplacé par
l'article 1 de l'Addendum III du 19 juin 2025. »

**Ajouter** une entrée :

| date_evenement | titre | contenu |
|---|---|---|
| 2025-06-19 | Addendum III, articles 1 et 2 — indivision de tous les biens communs | L'indivision porte sur tous les biens communs, entre tous les colotis, au prorata des superficies ; toute clé par lot mentionnée dans des actes de vente est réputée erronée et inopposable. Les biens communs sont l'allée de Rives jusqu'à la route de Messery, l'allée des Précettes, la plage privée et son accès, les deux miroirs de sécurité, le fossé d'eaux pluviales bordant l'allée de Rives, et les canalisations d'eaux pluviales sous les allées. Les canalisations desservant plusieurs colotis sous des lots privés, notamment celles qui desservent exclusivement la zone C, sont biens communs à condition que les colotis concernés acquittent leur quote-part des autres charges. L'article 2 remplace l'article 17 de l'additif de 1956 : la plage n'appartient plus aux seuls lots dépourvus d'accès privé au lac. |

---

## 3. Autres corrections

**Sujet « Contentieux SCI Villa Aysha »** — le résumé dit « fondé sur le non-respect de l'article
15 de l'additif de 1957 ». L'additif de 1957 ne modifie que l'article 4 (propriété de la rue).
L'article 15, relatif aux plantations, a été réécrit par l'additif de **1956**. Nouveau résumé :

> Second contentieux du lotissement, fondé sur le non-respect de l'article 15 du cahier des charges relatif aux plantations, dans sa rédaction issue de l'additif du 10 février 1956.

**Sujet « Distraction zone C »** — ajouter une entrée :

| date_evenement | titre | contenu |
|---|---|---|
| 2025-06-19 | Addendum III — la canalisation de la zone C est un bien commun sous condition | L'article 2 range parmi les biens communs les canalisations d'eaux pluviales qui desservent exclusivement la zone C, à condition que ses colotis acquittent leur quote-part des charges des autres biens communs. L'article 4 grève les parcelles traversées d'une servitude perpétuelle d'accès au profit du lotissement. Addendum adopté à l'assemblée où les sept colotis de la zone C se sont abstenus. |

---

## 4. Rapport attendu

Pour chaque correction : l'entrée trouvée (titre, date avant), ce qui a changé, ou « introuvable ».
Pour chaque ajout : créé, ou déjà présent. Pour chaque pièce : attachée, déjà présente, ou
introuvable. Et la liste des entrées restant en date sentinelle après exécution.
