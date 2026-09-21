// CORRECTIONS de la saisie initiale de la mémoire — données seules.
//
// Trois défauts signalés par Pascal (2026-09-21) après relecture de l'import du
// jour. Aucun n'était une erreur de mécanique : tous trois viennent de ce que le
// brief — et moi — avons raisonné sur des sujets isolés, alors que la mémoire du
// lotissement est un tout où le même acte apparaît dans plusieurs dossiers.
//
// ============================================================================
// 1. LES PIÈCES SONT SUR LE SUJET, PAS SUR L'ENTRÉE
// ============================================================================
// « Les fichiers sont attachés au sujet au lieu d'être sur l'entrée concernée. »
//
// Le brief demandait de les attacher au sujet, et c'est ce qui a été fait. Mais
// une pièce accrochée au sujet ne dit pas DE QUOI elle est la preuve : l'audit du
// réseau posé sur « Réseau eaux pluviales » flotte, le même posé sur l'entrée
// « Audit du réseau » date le document et le rattache à un fait. C'est toute la
// raison d'être de la migration 046.
//
// ⚠ AUCUN FICHIER N'EST RETÉLÉVERSÉ. Le chemin en Storage porte l'id du SUJET
// (`sujets/<id>/<uuid>.<ext>`, migration 046) et reste valable quelle que soit
// l'entrée qui le cite : on ne déplace qu'une référence jsonb. Ré-envoyer les
// fichiers aurait doublé 30 objets pour rien.
//
// ============================================================================
// 2. SEPT PIÈCES ÉTAIENT DES DOUBLONS
// ============================================================================
// « Statut juridique du lotissement » portait déjà, SUR SES ENTRÉES, sept des
// fichiers que l'import a posés sur le sujet — mêmes noms, mêmes documents.
//
// ⚠ POURQUOI L'IDEMPOTENCE NE L'A PAS VU : elle comparait les pièces du SUJET
// entre elles, jamais celles de ses entrées. Un doublon peut donc naître entre
// deux niveaux sans qu'aucune garde ne le remarque. Retenir pour la prochaine
// fois : vérifier l'existence là où la donnée peut VIVRE, pas là où on l'écrit.
//
// ============================================================================
// 3. DES DATES « INCONNUES » QUI ÉTAIENT CONNUES AILLEURS
// ============================================================================
// « Pour certaines entrées, elles sont déjà dans le sujet Statut juridique du
// lotissement, donc la date est déjà renseignée. »
//
// Le cahier des charges et l'Annexe I étaient entrés avec la date sentinelle dans
// « Biens communs », alors que « Statut juridique » les portait depuis longtemps
// avec leur vraie date. On ne les invente donc pas : ON LES RECOPIE de l'entrée
// qui les connaît, et la source est nommée ci-dessous pour qu'on puisse vérifier.

// -------------------------------------------------- dates retrouvées ailleurs
// ⚠ `source` n'est pas décoratif : c'est la pièce justificative de la correction.
// Une date changée dans un registre légal doit pouvoir être remontée à son
// origine, sinon elle vaut ce que vaut la mémoire de celui qui l'a saisie.
export const DATES_RETROUVEES = [
  {
    sujet: 'Biens communs et indivis',
    titreEntree: 'Cahier des charges du lotissement de Rives (août 1955)',
    date: '1955-08-22',
    source: 'Entrée « Cahier des Charges » du sujet « Statut juridique du lotissement »',
  },
  {
    sujet: 'Biens communs et indivis',
    titreEntree: 'Annexe I — arbres et plage (février 1956)',
    date: '1956-02-10',
    source: 'Entrée « Annexe I au Cahier des Charges » du sujet « Statut juridique du lotissement »',
  },
]

// ------------------------------------------------------------ doublons à ôter
// Retirés du SUJET (la référence jsonb) ET du Storage : ce sont des copies
// exactes créées aujourd'hui, dont l'original est déjà attaché à l'entrée qui les
// justifie. Les laisser ferait deux exemplaires du même acte dans le même dossier.
export const DOUBLONS_SUJET = [
  {
    sujet: 'Statut juridique du lotissement',
    fichiers: [
      '1955 août-cahier des charges.pdf',
      '1956 février-Annexe I (plage).pdf',
      '1957 janvier-Annexe II (propriété allées).pdf',
      'ADDENDUM III suite au vote du 17_avril:_2025 v3.pdf',
      'Lotissement_Rives_Note_Synthese_v13.pdf',
      'MEMO Avocats 24:1:25.pdf',
      'Réponses Avocats 6:2:25.pdf',
    ],
  },
]

// ------------------------------------------- pièces à déplacer vers une entrée
// `titreEntree` doit correspondre EXACTEMENT au titre de l'entrée cible. Une
// pièce dont l'entrée n'est pas trouvée reste sur le sujet et est signalée : on
// ne devine pas où ranger une preuve.
export const PIECES_VERS_ENTREE = [
  // --- Réseau eaux pluviales : chaque pièce a son entrée, créée pour elle.
  { sujet: 'Réseau eaux pluviales — mémoire de l’association', fichier: '2034 Les Rives Nernier_Audit EP.pdf', titreEntree: 'Audit du réseau d’eaux pluviales' },
  { sujet: 'Réseau eaux pluviales — mémoire de l’association', fichier: 'NERNIER RIVE Rapport inspection visuelle.pdf', titreEntree: 'Rapport d’inspection visuelle du réseau' },
  { sujet: 'Réseau eaux pluviales — mémoire de l’association', fichier: 'Plan écoulement.pdf', titreEntree: 'Plans d’écoulement (version lotissement et version mairie)' },
  { sujet: 'Réseau eaux pluviales — mémoire de l’association', fichier: 'Plan écoulement Mairie.pdf', titreEntree: 'Plans d’écoulement (version lotissement et version mairie)' },
  { sujet: 'Réseau eaux pluviales — mémoire de l’association', fichier: 'Plans Thonon Agglo.pdf', titreEntree: 'Plans Thonon Agglo' },
  { sujet: 'Réseau eaux pluviales — mémoire de l’association', fichier: '2021-01-11 Rec EP_500ème.pdf', titreEntree: 'Relevé EP au 500ème' },
  { sujet: 'Réseau eaux pluviales — mémoire de l’association', fichier: '53 lettre maire reseau ep.pdf', titreEntree: 'Lettre du maire sur le réseau EP' },

  // --- Urbanisme : seule la lettre DDT a une entrée. Le PLU n'en a pas, et n'en
  // a pas besoin : un règlement d'urbanisme n'est pas un événement daté.
  { sujet: 'Urbanisme et servitudes', fichier: 'Lettre DDT 2021.pdf', titreEntree: 'Lettre de la DDT' },

  // --- Biens communs : la décision de 1961 a son entrée, désormais datée.
  { sujet: 'Biens communs et indivis', fichier: '1961 - Décision des colotis de garder les allées privées.pdf', titreEntree: 'Décision des colotis de garder les allées privées' },

  // --- Distraction zone C : la déclaration commune est l'objet de son entrée.
  { sujet: 'Distraction zone C', fichier: 'Lettre colotis zone C AG 2026.pdf', titreEntree: 'Remise de la déclaration commune des colotis de la zone C' },
]

// ⚠ CE QUI RESTE VOLONTAIREMENT SUR LE SUJET, et pourquoi. Une pièce qui décrit
// le dossier dans son ensemble n'appartient à aucun fait daté ; l'accrocher à une
// entrée au hasard lui donnerait une date qu'elle n'a pas. Ces fichiers-là sont
// bien là où ils sont — c'est un choix, pas un oubli :
//
//   Biens communs   : _____allées indivision.pdf, cession de la plage.pdf,
//                     plan de masse.pdf, Liste de indivis.docx
//   Distraction C   : 3 scenarios.xlsx, lettre demande de sortie.docx,
//                     lettre M. Tkatchouk.pdf
//   Réseau EP       : lotissement.jpg, Questions pour le maitre d'oeuvre.pdf
//   Urbanisme       : reglement PLU.pdf, plan_zonage.pdf
//   Syndic          : Comparaison Syndics.pdf
//   Fonds travaux   : Redistribution / Restitution fonds travaux.pdf
//   Statut juridique: Chronologie_ASL_Rives_officielle…pdf (antérieure à l'import)
//
// Pascal peut en déplacer depuis l'écran s'il juge qu'une d'elles se rattache à
// un fait précis — c'est une question de dossier, pas de script.
