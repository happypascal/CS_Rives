// Urbanisme et servitudes, et corrections de l'import du 21 septembre — données.
//
// Source : `BRIEF_urbanisme_et_corrections_2026-09-21.md`, établi sur lecture des
// actes eux-mêmes (cahier des charges 1955, additifs 1956 et 1957, Addendum III
// 2025, arrêtés préfectoraux de 1961, PLU 2013).
//
// ⚠ TROIS PROPOSITIONS DU BRIEF NE SONT PAS APPLIQUÉES, et c'est délibéré : elles
// écraseraient des dates que Pascal a saisies À LA MAIN après l'import. Elles
// sont rassemblées dans `CONFLITS`, rapportées et non exécutées. Un brief est
// écrit sans voir la base ; la base, elle, porte le travail de quelqu'un.

// ============================================================================
// 1. SYNTHÈSES DE SUJETS — remplacées
// ============================================================================
// ⚠ Contenu en HTML simple (`<p>`, `<strong>`, `<ul><li>`), sans style en ligne :
// c'est ce que produit `RichTextEditor`, et l'export le reconvertit en texte.
export const SUJETS_MAJ = [
  {
    titre: 'Urbanisme et servitudes',
    resume: 'Servitudes perpétuelles du cahier des charges — constructions, plantations, clôtures, réseaux, passages — et règles d’urbanisme applicables au lotissement.',
    contenu:
      '<p>Deux ordres de règles s’appliquent au lotissement, et ils ne se confondent pas. Les servitudes du cahier des charges relèvent du <strong>droit privé</strong> : elles lient les colotis entre eux, à perpétuité, et sont opposables à tout acquéreur puisque les actes ont été publiés au fichier immobilier. Les règles d’urbanisme relèvent du <strong>droit public</strong> : elles changent avec le document d’urbanisme et s’imposent à toute demande d’autorisation. Les deux s’appliquent ensemble ; en pratique, c’est la plus stricte qui fixe ce qu’on peut faire.</p>' +
      '<p><strong>Servitudes du cahier des charges</strong></p>' +
      '<ul>' +
      '<li><strong>Destination</strong> (art. 13, 1955) : habitation bourgeoise. L’exploitation d’un commerce et les colonies de vacances sont interdites, à titre de servitude perpétuelle et réciproque.</li>' +
      '<li><strong>Non aedificandi</strong> (art. 14, 1955) : 15 m libres de toute construction depuis les rives du Léman ; 5 m depuis les voies d’accès ; 15 m entre deux constructions d’un même lot ; recul d’au moins 3 m des limites séparatives, et d’au moins la moitié de la hauteur de corniche ; en zone A, hauteur maximale de 10 m à moins de 40 m des rives, 8 m au-delà. Tout morcellement ultérieur d’un lot est soumis à approbation préfectorale.</li>' +
      '<li><strong>Plantations</strong> (art. 15, dans sa rédaction issue de l’additif du 10 février 1956) : en zones A et B, sauf les lots B1 et B2, arbres de 7 m au plus le long des limites séparatives, sur une bande de 5 m de large et sur 40 m au plus depuis le lac (zone A) ou depuis le chemin d’accès (zone B) ; lots D1 à D6, bande de 5 m le long des limites perpendiculaires au lac, 7 m au plus ; lots B1, B2 et zone E, aux seuls emplacements prévus au plan de masse. La zone C et les lots D7, D8, E7 et E8 ne sont soumis à aucune restriction. Cet article fonde les contentieux SCI Violette et SCI Villa Aysha.</li>' +
      '<li><strong>Clôtures</strong> (art. 12, 1955) : grille de 1,50 m, ou mur bahut de 0,50 m au plus surmonté d’une grille, le tout ne dépassant pas 1,50 m, ou haie vive.</li>' +
      '<li><strong>Réseaux</strong> : aisance de 3 m de part et d’autre des collecteurs d’eau et d’égout sur l’ensemble du lotissement (additif de 1956) ; servitude perpétuelle et irrévocable d’accès, sans indemnité, au profit du lotissement sur les parcelles où passent les canalisations d’eaux pluviales biens communs, après préavis écrit de trente jours sauf urgence (Addendum III, art. 4, 19 juin 2025) ; obligation pour les riverains de supporter sans indemnité les signes indicateurs et les fils télégraphiques, téléphoniques et électriques sur leurs clôtures et constructions (art. 9-10°, 1955).</li>' +
      '<li><strong>Usage de la voie</strong> (art. 5 et 9, 1955) : la voie est affectée à perpétuité à la circulation entre acquéreurs et reste « absolument privée » tant qu’elle n’est pas classée. Les dégradations causées par des travaux sont à la charge de l’acquéreur responsable ; faute de remise en état dans le mois suivant une sommation, le syndicat peut y faire procéder à ses frais.</li>' +
      '</ul>' +
      '<p><strong>Passages et plages</strong></p>' +
      '<p>Les actes connaissent <strong>deux plages</strong>. La <strong>plage commune</strong>, créée par l’additif de 1956 le long de la limite ouest du lotissement, est un bien commun ; l’Addendum III du 19 juin 2025 l’a rangée parmi les biens indivis de tous les colotis. La <strong>plage communale</strong>, sur le lot n° 13, devait être cédée gratuitement à la commune pour servir aux acquéreurs comme aux habitants de Nernier : l’arrêté préfectoral du 5 mai 1961 impose cette cession et un droit de passage au profit des usagers de cette plage sur la partie de la voie reliant le lot n° 13 à la route de Messery. Le cahier des charges de 1955 accordait en outre un droit de passage à MM. Charles et Clet, riverains à l’est du lot n° 13, sur la même portion de voie.</p>' +
      '<p>Le lotissement n’est donc <strong>pas entièrement fermé au public en droit</strong>. Deux points restent à établir : si la cession de la plage communale a été réalisée par acte, et quelle suite a été donnée au recours gracieux formé par Mme de Leusse contre l’arrêté de 1961.</p>' +
      '<p><strong>Règles d’urbanisme</strong></p>' +
      '<p>Le document en vigueur est le <strong>PLUi-HM de Thonon Agglomération</strong>, approuvé par délibération du conseil communautaire du 16 décembre 2025 (DEL_CC2025_00312). Sur le règlement graphique de Nernier, le lotissement relève de deux zones :</p>' +
      '<ul>' +
      '<li>les <strong>lots riverains du lac</strong>, le long de l’allée de Rives (parcelles 0196 à 0212 environ), sont en <strong>zone NL</strong> — zone naturelle littorale, bande des 100 m de la loi Littoral dans ses parties considérées comme non urbanisées. Les habitations existantes d’au moins 50 m² de surface de plancher peuvent y être refaites, réhabilitées et aménagées, sans modification de volume ; les annexes existantes peuvent être réhabilitées, sans modification de volume. Hauteur maximale 7 m, emprise au sol 0,20 au plus ;</li>' +
      '<li>les <strong>lots intérieurs</strong>, entre l’allée de Rives et la route de Messery (Champ Catin), sont en <strong>zone UCp</strong> — centralité des villages avec enjeux paysagers. Hauteur maximale des constructions principales 7 m, ou 6 m en toiture-terrasse ; emprise au sol 0,25 au plus ; 55 % d’espaces perméables, dont 35 % du tènement en pleine terre ; un arbre de haute tige pour 100 m² de pleine terre ; recul d’au moins 3 m des limites séparatives, et d’au moins la moitié de la différence d’altitude.</li>' +
      '</ul>' +
      '<p><strong>Clôtures et haies</strong> (art. UC.II.4.c-d et N II.4.c-d, rédaction identique pour l’essentiel) :</p>' +
      '<ul>' +
      '<li>les clôtures ne sont pas obligatoires ; leur édification est soumise à <strong>déclaration préalable</strong> ;</li>' +
      '<li><strong>hauteur maximale 1,60 m</strong>, sur le domaine public comme en limite séparative ;</li>' +
      '<li>composition : soit une clôture à claire-voie (lattes, grilles, grillages) ajourée à 20 % au moins, doublée ou non d’une haie, sur un mur bahut de 0,60 m au plus ; soit <strong>une haie végétalisée d’essences locales et variées</strong>. Une palissade opaque n’est admise en limite séparative qu’entre constructions mitoyennes, sur 5 m au plus de part et d’autre. Canisses, brandes, bâches, films et toiles sont interdits ;</li>' +
      '<li><strong>la haie qui tient lieu de clôture est donc limitée à 1,60 m.</strong> Le règlement ne fixe pas de hauteur propre aux haies plantées à l’intérieur du terrain ;</li>' +
      '<li>les <strong>haies monovégétales disposées en mur rideau</strong> sur le pourtour des limites parcellaires sont interdites (fin des haies de thuyas ou de laurier en continu) ; renvoi à l’OAP « Biodiversité et continuités écologiques » ;</li>' +
      '<li><strong>en zone NL</strong>, les clôtures doivent en outre laisser passer la petite faune : un passage libre d’au moins 20 cm de haut sur 30 cm de large, tous les 5 m au plus ; le mur bahut n’y est admis que pour prolonger un mur bahut existant ;</li>' +
      '<li>portails : 1,80 m au plus ;</li>' +
      '<li>la restauration ou la reconstruction d’une clôture existante peut conserver la hauteur de l’existant, même supérieure.</li>' +
      '</ul>' +
      '<p>⚠ Ces règles <strong>se cumulent</strong> avec le cahier des charges (clôture à grille de 1,50 m au plus, art. 12) et avec le Code civil : une plantation de plus de 2 m doit être à 2 m au moins de la limite, une plantation plus basse à 0,50 m (art. 671). <strong>La règle la plus stricte s’applique</strong> : 1,50 m pour une grille, 1,60 m pour une haie de clôture.</p>' +
      '<p>Le plan porte aussi un <strong>emplacement réservé n° 534</strong> sur la route de Messery, au droit de l’entrée du lotissement ; son objet est à vérifier dans la liste des emplacements réservés, qui ne figure pas dans le dossier.</p>' +
      '<p><em>Historique.</em> Le PLU communal de 2013 (révision n° 2, approuvée le 22 avril 2013) classait les lots riverains en zone UCh, leur frange littorale en zone Nl et les lots intérieurs en zone UC ; il limitait les haies à 2 m et prévoyait les emplacements réservés n° 4 (accès piéton au lac à l’entrée du lotissement) et n° 15 bis (élargissement de la route de Messery). Il a été remplacé par le PLUi du Bas-Chablais, puis par le PLUi-HM.</p>',
  },
  {
    titre: 'Contentieux SCI Villa Aysha',
    // ⚠ Correction de FOND : l'additif de 1957 ne modifie que l'article 4
    // (propriété de la rue). L'article 15, sur les plantations, a été réécrit par
    // l'additif de 1956. Citer le mauvais acte dans un registre qui sert de base
    // à un contentieux n'est pas une coquille.
    resume: 'Second contentieux du lotissement, fondé sur le non-respect de l’article 15 du cahier des charges relatif aux plantations, dans sa rédaction issue de l’additif du 10 février 1956.',
  },
]

// ============================================================================
// 2. ENTRÉES EXISTANTES — corrigées ou complétées
// ============================================================================
// `ajoutContenu` AJOUTE en fin de contenu au lieu de remplacer : ce qui est déjà
// écrit a été écrit par quelqu'un.
export const ENTREES_MAJ = [
  {
    sujet: 'Biens communs et indivis',
    titreActuel: 'Cahier des charges du lotissement de Rives (août 1955)',
    ajoutContenu: 'Arrêté préfectoral n° 5184-55 du 22 août 1955 ; cahier des charges déposé chez Me André Naz le 5 septembre 1955.',
  },
  {
    sujet: 'Biens communs et indivis',
    titreActuel: 'Annexe I — arbres et plage (février 1956)',
    titre: 'Premier additif — extension, plantations et plage commune',
    contenu: 'Arrêté préfectoral n° 7955-56. L’additif remplace l’article 15 sur les plantations, institue une aisance de 3 m autour des collecteurs, et crée une plage commune le long de la limite ouest, appartenant indivisément aux lots qui n’ont pas d’accès privé au lac, au prorata de leur superficie, avec les frais d’entretien à leur charge. Cette règle de propriété et de charge a été remplacée par l’Addendum III du 19 juin 2025.',
  },
  {
    sujet: 'Biens communs et indivis',
    titreActuel: 'Acte de dépôt chez Me André Naz',
    ajoutContenu: 'Cet article 4 prévoyait aussi que le droit de propriété des acquéreurs sur le sol de la rue cesserait le jour où la commune classerait la rue comme voie publique. Il a été remplacé par l’article 1 de l’Addendum III du 19 juin 2025.',
  },
  {
    // ⚠ SEULE LA PARTIE NON CONFLICTUELLE EST APPLIQUÉE. Le brief voulait
    // transformer cette entrée en « Arrêté préfectoral du 5 mai 1961 » ; Pascal
    // l'a datée du 4 novembre 1961 à la main, et la pièce qu'elle porte EST la
    // lettre du maire. On corrige donc le TITRE — qui est faux, le brief a raison
    // sur ce point — sans toucher à sa date ni à sa pièce. L'arrêté du 5 mai
    // devient une entrée distincte, ce qu'il est.
    sujet: 'Biens communs et indivis',
    titreActuel: 'Décision des colotis de garder les allées privées',
    titre: 'Lettre du maire au sous-préfet sur le recours de Mme de Leusse',
    contenu: 'Mme de Leusse a formé un recours gracieux contre l’arrêté du 5 mai 1961. Le maire rapporte que les acquéreurs préfèrent entretenir leurs routes pour conserver au lotissement son caractère privé, et refuse d’abandonner la propriété du chemin d’accès à la plage contre un simple droit de passage. ⚠ La pièce classée sous le nom « 1961 - Décision des colotis de garder les allées privées » est cette lettre du maire : elle rapporte la préférence des acquéreurs, elle ne constitue PAS une décision des colotis. L’article L.318-3 du code de l’urbanisme ne permet le transfert d’office que d’une voie ouverte à la circulation publique : le droit de passage de 1961 au profit des usagers de la plage communale est le point à examiner à cet égard. Suite donnée au recours inconnue.',
  },
]

// ============================================================================
// 3. ENTRÉES NOUVELLES
// ============================================================================
// ⚠ Entrée du PLU de 2013 : elle n'est plus « à vérifier », elle est ABROGÉE, et
// le document qui l'a remplacée est nommé. Un registre qui laisse un document
// d'urbanisme sans dire ce qui lui succède envoie consulter un texte mort.
export const ENTREES_MAJ_2 = [
  {
    sujet: 'Urbanisme et servitudes',
    titreActuel: 'Approbation de la révision n° 2 du PLU de Nernier',
    contenu: 'Classement du lotissement en zones UCh, UC et Nl ; emplacements réservés n° 4 (accès piéton au lac à l’entrée du lotissement) et n° 15 bis (élargissement de la route de Messery). ⚠ Document ABROGÉ : remplacé par le PLUi du Bas-Chablais, puis par le PLUi-HM de Thonon Agglomération (voir l’entrée du 16 décembre 2025).',
  },
]

// ============================================================================
// Révision du brief, 3e passage — deux corrections nommément demandées.
// ============================================================================
export const ENTREES_MAJ_3 = [
  {
    // « l'additif crée les lots E1 à E8, erreur de lecture de ma part » (brief).
    sujet: 'Urbanisme et servitudes',
    titreActuel: 'Arrêté préfectoral n° 7955-56 — extension et premier additif',
    contenu: 'Extension au lieu-dit Champ Catin, lots A14 à A16 et E1 à E8. L’additif remplace l’article 15 sur les plantations, institue une aisance de 3 m de part et d’autre des collecteurs d’eau et d’égout, et crée la plage commune le long de la limite ouest. Acte de dépôt chez Me Naz le 26 mars 1956, transcrit le 8 mai 1956, volume 612 n° 55.',
  },
  {
    // ⚠ CECI CLÔT LE CONFLIT N° 3 du passage précédent. Je refusais de créer une
    // seconde entrée au 21 février 1961 tant qu'on ignorait si c'était le même
    // acte que celle de Pascal. Le brief l'a vérifié SUR LA PIÈCE : c'est bien
    // l'arrêté n° 5835-61. On renomme donc l'existante — aucun doublon.
    sujet: 'Urbanisme et servitudes',
    titreActuel: 'Modifications parcellaires Luscher / Van Den Berg',
    titre: 'Arrêté préfectoral n° 5835-61 — modification parcellaire (lots E, Luscher / Van Den Berg)',
    // Le contenu était vide (« <br> ») : on le renseigne, on n'écrase rien.
    contenu: 'Modification du plan parcellaire du lotissement, visée par l’arrêté du 5 mai 1961.',
  },
]

export const ENTREES_NOUVELLES = [
  {
    sujet: 'Urbanisme et servitudes',
    date: '1955-08-22',
    titre: 'Arrêté préfectoral n° 5184-55 autorisant le lotissement de Rives',
    contenu: '43 lots sur environ 10 ha, section B n° 122, 123, 129 et 130, au lieu-dit Rives. Le cahier des charges, déposé chez Me André Naz le 5 septembre 1955, fixe les servitudes de destination, de non aedificandi, de clôture et de plantation, et l’usage privé de la voie.',
    pieces: ['4_ASL/3-cahier des charges/1955 août-cahier des charges.pdf'],
  },
  {
    sujet: 'Urbanisme et servitudes',
    date: '1956-02-10',
    titre: 'Arrêté préfectoral n° 7955-56 — extension et premier additif',
    contenu: 'Extension au lieu-dit Champ Catin, lots A14 à A16 et E4 à E8. L’additif remplace l’article 15 sur les plantations, institue une aisance de 3 m de part et d’autre des collecteurs d’eau et d’égout, et crée la plage commune le long de la limite ouest. Acte de dépôt chez Me Naz le 26 mars 1956, transcrit le 8 mai 1956, volume 612 n° 55.',
    pieces: ['4_ASL/3-cahier des charges/1956 février-Annexe I (plage).pdf'],
  },
  {
    sujet: 'Urbanisme et servitudes',
    date: '1961-05-05',
    titre: 'Arrêté préfectoral — cession de la plage communale et droit de passage',
    contenu: 'À la demande du maire de Nernier, l’article 5 de l’arrêté de 1955 est remplacé : le lotisseur cède gratuitement à la commune une partie du lot n° 13 — un carré de 20 m sur 20 m au bord du lac et un couloir d’accès de 3 m côté levant —, à condition qu’elle serve exclusivement de plage aux acquéreurs du lotissement comme aux habitants de Nernier. Le lotisseur et ses acquéreurs doivent consentir aux usagers de cette plage un droit de passage sur la partie de la voie reliant le lot n° 13 à la route de Messery. Arrêté publié au bureau des hypothèques.',
    pieces: ['4_ASL/2-documents mairie/cession de la plage.pdf'],
  },
  {
    sujet: 'Urbanisme et servitudes',
    date: '2013-04-22',
    titre: 'Approbation de la révision n° 2 du PLU de Nernier',
    contenu: 'Classement du lotissement en zones UCh, UC et Nl ; emplacements réservés n° 4 (accès piéton au lac à l’entrée du lotissement) et n° 15 bis (élargissement de la route de Messery). ⚠ Document remplacé depuis par le PLUi du Bas-Chablais puis par le PLUi-HM de Thonon Agglomération : à vérifier sur le Géoportail de l’urbanisme avant toute démarche.',
    // ⚠ `code civil art 671.png` n'est PLUS ici : le brief révisé la range sur
    // l'entrée du PLUi-HM. La laisser dans les deux listes faisait que chaque
    // exécution la reprenait à l'autre — un aller-retour sans fin, invisible
    // autrement qu'en comparant deux rapports.
    pieces: ['PLU/reglement PLU.pdf', 'PLU/plan_zonage.pdf'],
  },
  {
    sujet: 'Urbanisme et servitudes',
    date: '2025-06-19',
    titre: 'Addendum III, article 4 — servitude d’accès aux réseaux d’eaux pluviales',
    contenu: 'Les propriétaires des parcelles où passent ou doivent passer les canalisations d’eaux pluviales biens communs consentent au profit du lotissement une servitude perpétuelle et irrévocable d’accès, sans indemnité, pour leur réalisation, leur entretien et leur réparation. Préavis écrit de trente jours avant travaux, sauf urgence ; remise en état à la charge du lotissement.',
    pieces: [],
  },
  {
    sujet: 'Urbanisme et servitudes',
    date: '2025-12-16',
    titre: 'Approbation du PLUi-HM de Thonon Agglomération',
    contenu: 'Délibération DEL_CC2025_00312. Lots riverains du lac en zone NL (naturelle littorale, bande des 100 m), lots intérieurs en zone UCp. Clôtures soumises à déclaration préalable, 1,60 m au plus, à claire-voie ou en haie d’essences locales et variées ; haies monovégétales en mur rideau interdites ; en NL, passages pour la petite faune tous les 5 m au plus ; portails 1,80 m. Emplacement réservé n° 534 sur la route de Messery, objet à vérifier. ⚠ C’est le document EN VIGUEUR : c’est lui qu’il faut consulter avant toute demande d’autorisation.',
    pieces: [
      'PLU/PLU 2026/0_Actes administratifs/DEL_CC2025_00312_Approbation_PLUiHM.pdf',
      'PLU/PLU 2026/3_REGLEMENT/200067551_reglement_20251216.pdf',
      'PLU/PLU 2026/3_REGLEMENT/Règlement graphique/200067551_reglement_graphique_38_nernier_2500_20251216.pdf',
      // ⚠ Ce fichier n'est plus sur le disque (Pascal a rangé PLU/ dans _OLD/),
      // mais il est DÉJÀ dans le Storage, attaché à l'entrée de 2013. Le script
      // le déplace depuis cette entrée : aucun accès disque, aucun retéléversement.
      'PLU/code civil art 671.png',
    ],
  },
  {
    sujet: 'Biens communs et indivis',
    date: '2025-06-19',
    titre: 'Addendum III, articles 1 et 2 — indivision de tous les biens communs',
    contenu: 'L’indivision porte sur tous les biens communs, entre tous les colotis, au prorata des superficies ; toute clé par lot mentionnée dans des actes de vente est réputée erronée et inopposable. Les biens communs sont l’allée de Rives jusqu’à la route de Messery, l’allée des Précettes, la plage privée et son accès, les deux miroirs de sécurité, le fossé d’eaux pluviales bordant l’allée de Rives, et les canalisations d’eaux pluviales sous les allées. Les canalisations desservant plusieurs colotis sous des lots privés, notamment celles qui desservent exclusivement la zone C, sont biens communs à condition que les colotis concernés acquittent leur quote-part des autres charges. L’article 2 remplace l’article 17 de l’additif de 1956 : la plage n’appartient plus aux seuls lots dépourvus d’accès privé au lac.',
    pieces: [],
  },
  {
    sujet: 'Distraction zone C',
    date: '2025-06-19',
    titre: 'Addendum III — la canalisation de la zone C est un bien commun sous condition',
    contenu: 'L’article 2 range parmi les biens communs les canalisations d’eaux pluviales qui desservent exclusivement la zone C, à condition que ses colotis acquittent leur quote-part des charges des autres biens communs. L’article 4 grève les parcelles traversées d’une servitude perpétuelle d’accès au profit du lotissement. Addendum adopté à l’assemblée où les sept colotis de la zone C se sont abstenus.',
    pieces: [],
  },
]

// ============================================================================
// 4. CONFLITS — RAPPORTÉS, JAMAIS APPLIQUÉS
// ============================================================================
// ⚠ Ces trois points du brief heurtent des données saisies à la main après
// l'import. Un brief est écrit sans voir la base ; la base porte le travail de
// quelqu'un. On ne tranche pas à sa place.
export const CONFLITS = [
  {
    quoi: 'Date de l’entrée « Décision des colotis… » (Biens communs)',
    brief: 'La remplacer par l’arrêté du 5 mai 1961.',
    base: 'Pascal l’a datée du 4 novembre 1961 et elle porte la pièce (la lettre du maire).',
    fait: 'Titre corrigé en « Lettre du maire au sous-préfet… » — le brief a raison sur ce point. Date et pièce INCHANGÉES. L’arrêté du 5 mai 1961 est créé comme entrée distincte dans Urbanisme.',
    aTrancher: 'Le 4 novembre 1961 est-il bien la date de cette lettre ? Si oui, plus rien à faire.',
  },
  {
    quoi: 'Entrée « Lettre du maire au sous-préfet » en date sentinelle (brief §1.3)',
    brief: 'La créer dans « Urbanisme et servitudes ».',
    base: 'C’est le même document que l’entrée de « Biens communs » datée du 4 novembre 1961.',
    fait: 'NON CRÉÉE — elle aurait fait deux fois le même acte dans deux dossiers, sans que rien ne le signale.',
    aTrancher: 'Faut-il la dupliquer volontairement dans Urbanisme, ou le renvoi depuis la synthèse suffit-il ?',
  },
  // ⚠ Le troisième conflit est CLOS : le brief a vérifié sur la pièce qu'il
  // s'agit du même acte. L'entrée existante est renommée (ENTREES_MAJ_3), aucun
  // doublon n'a été créé. Conservé ici pour mémoire de la façon dont il s'est
  // résolu — par une vérification, pas par un arbitrage.
  {
    quoi: 'Numéro de l’arrêté de 1955 — ÉCART NON RÉSOLU',
    brief: 'La révision du 21 septembre écrit « n° 3164-55 ».',
    base: 'Le registre porte « n° 5184-55 », d’après la première version du même brief.',
    fait: 'RIEN CHANGÉ. Le numéro a été modifié en silence entre deux révisions, sans figurer dans les consignes. J’ai cherché à trancher sur les actes : le PDF est un scan sans couche texte, et le .docx du dépôt notarié ne cite que la DATE (22 août 1955), sans numéro.',
    aTrancher: 'Lequel est le bon ? Il est lisible sur le scan de l’arrêté lui-même. Un numéro d’arrêté faux dans un registre légal se recopie ensuite partout.',
  },
]

export const RACINE_PIECES = '..'
