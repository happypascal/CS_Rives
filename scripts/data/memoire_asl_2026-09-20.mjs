// CONTENU de la saisie initiale de la mémoire de l'ASL — données seules.
//
// Séparé de `import_memoire.mjs` à dessein (brief du 20 septembre 2026) : on doit
// pouvoir RELIRE ce qui va entrer au registre sans lire une ligne de mécanique, et
// pouvoir le rejouer plus tard. Ce fichier n'exécute rien.
//
// Source : analyse du dossier `_1_lotissement` et de l'export du registre, par une
// session Claude, consignée dans `BRIEF_saisie_memoire_ASL.md`.
//
// ⚠ DATE SENTINELLE 1999-09-09. Arbitrage de Pascal (2026-09-21) : « si il n'y a
// pas de date tu mets 9/9/1999 et je corrigerai. » `date_evenement` est `not null`
// et le registre se trie dessus ; il fallait donc une valeur. Celle-ci est
// délibérément ABSURDE — aucun événement du lotissement n'a eu lieu en 1999 — pour
// qu'elle saute aux yeux et ne puisse pas être prise pour une date réelle. Le
// script d'import les recense toutes en fin de rapport.
//
// ⚠ Le brief marquait trois de ces dates « jour à confirmer » en proposant le 1er
// du mois (1955-08-01, 1956-02-01, 1961-01-01). Ces jours-là étaient INVENTÉS, et
// un 1er du mois ne se distingue pas d'une vraie date. Ils sont remplacés par la
// sentinelle : mieux vaut un trou visible qu'une date plausible et fausse.

export const DATE_SENTINELLE = '1999-09-09'
const D = DATE_SENTINELLE

// Racine des pièces à téléverser, relative au dossier du lotissement.
export const RACINE_PIECES = '..'

// ⚠ SUJETS DÉJÀ CRÉÉS PAR PASCAL SOUS UN TITRE VOISIN. Constaté à l'essai à blanc
// du 2026-09-21 : la base contenait déjà « Biens communs et indivis » (vide),
// quand le brief demande « Biens communs et indivision ».
//
// L'unicité du titre n'aurait rien empêché : les deux chaînes diffèrent. Le script
// aurait donc créé un SECOND sujet presque homonyme — exactement le mode de ruine
// contre lequel l'unicité existe, « deux sujets Portail dont aucun n'est complet ».
//
// On écrit donc DANS LE SUJET EXISTANT, sous SON titre. Le renommer serait un acte
// éditorial sur la mémoire du conseil : c'est à Pascal, d'un clic, pas à un script
// d'import.
export const ALIAS_TITRES = {
  'Biens communs et indivision': 'Biens communs et indivis',
}

export const SUJETS = [
  // ------------------------------------------------------------------ 1.1
  {
    titre: 'Biens communs et indivision',
    categorie: 'Juridique et statuts',
    resume:
      'Les biens communs — sol des allées (parcelle B228), couloirs d’accès, plage, réseaux — sont en indivision forcée et perpétuelle entre les colotis, au prorata de la superficie de leur lot, et inséparables de celui-ci.',
    contenu:
      '<p>Le régime des biens communs du lotissement ne résulte pas des statuts de 2026 mais du cahier des charges de 1955 et de son additif de janvier 1957. L’additif dispose que le sol de la rue nouvelle et les couloirs d’accès appartiennent « indivisément aux acquéreurs de tous les lots et chacun en proportion de la superficie de son lot », que cette indivision est perpétuelle, et que ces droits « ne pourront être vendus, échangés ou hypothéqués séparément du surplus de leur propriété dont ils forment l’accessoire ».</p>' +
      '<p>L’assemblée du 15 septembre 2026 n’a rien changé à ce régime : la résolution 4 constate expressément que la mise en conformité des statuts intervient « sans remise en cause de la nature indivise des biens communs ». L’ASL administre ces biens ; elle n’en est pas propriétaire.</p>',
    entrees: [
      { date: D, titre: 'Cahier des charges du lotissement de Rives (août 1955)', contenu: 'Acte fondateur. L’article 18 organise le syndicat des colotis, les règles de vote et de majorité. C’est lui qui, selon Me Garnier, crée de fait l’association syndicale libre. ⚠ Jour exact à confirmer.' },
      { date: D, titre: 'Annexe I — arbres et plage (février 1956)', contenu: 'Première annexe au cahier des charges. ⚠ Jour exact à confirmer.' },
      { date: '1956-11-19', titre: 'Signature de l’additif au cahier des charges', contenu: 'Additif portant sur la propriété des allées.' },
      { date: '1956-12-04', titre: 'Avis du maire de Nernier', contenu: 'Avis favorable préalable à l’approbation préfectorale.' },
      { date: '1957-01-09', titre: 'Arrêté préfectoral approuvant l’additif', contenu: 'Approbation administrative de l’additif signé le 19 novembre 1956.' },
      { date: '1957-01-15', titre: 'Acte de dépôt chez Me André Naz', contenu: 'Dépôt notarié de l’additif. Le nouvel article 4 dispose que le sol de la rue et les couloirs d’accès appartiennent « indivisément aux acquéreurs de tous les lots et chacun en proportion de la superficie de son lot », en perpétuelle indivision, et qu’ils « ne pourront être vendus… séparément du surplus de leur propriété dont ils forment l’accessoire ». Enregistré à Thonon le 28 janvier 1957, transcrit le 13 février 1957, volume 641 n° 41.' },
      { date: D, titre: 'Décision des colotis de garder les allées privées (vers 1961)', contenu: 'Les colotis décident de conserver le caractère privé des allées plutôt que de les céder à la commune. Pièce déterminante : l’article L.318-3 du code de l’urbanisme ne permet le transfert d’office d’une voie privée dans le domaine public communal que si elle est ouverte à la circulation publique. ⚠ Date exacte à confirmer.' },
      { date: '2026-09-15', titre: 'L’assemblée approuve les statuts sans toucher à l’indivision', contenu: 'Résolution 4 : la mise en conformité intervient « sans remise en cause de la nature indivise des biens communs, et conformément aux articles 1 à 7 de la modification du cahier des charges approuvés en assemblée générale extraordinaire du 19 juin 2025 ».' },
    ],
    pieces: [
      '4_ASL/1-#50-Superficies/_____allées indivision.pdf',
      '4_ASL/2-documents mairie/1961 - Décision des colotis de garder les allées privées.pdf',
      '4_ASL/2-documents mairie/cession de la plage.pdf',
      '4_ASL/2-documents mairie/plan de masse.pdf',
      '4_ASL/5-règles indivis/Liste de indivis.docx',
    ],
  },

  // ------------------------------------------------------------------ 1.2
  {
    titre: 'Distraction zone C',
    categorie: 'Juridique et statuts',
    resume:
      'Sept colotis de la zone C, représentant 14 280 m² sur 104 646, demandent la distraction de leurs parcelles du périmètre de l’ASL ; la décision appartient à l’assemblée du 14 septembre 2027.',
    contenu:
      '<p>Les sept propriétaires de la zone C — six sur la Route de Messery et un en haut de l’allée de Rives — ont remis au président de séance, avant l’ouverture de l’assemblée du 15 septembre 2026, une déclaration commune signée demandant l’ouverture d’une procédure de distraction collective de leurs parcelles du périmètre de l’association, sur le fondement de l’article 26 des statuts.</p>' +
      '<p>Aucune résolution n’étant inscrite à l’ordre du jour sur ce point, l’assemblée n’a pas délibéré et aucune décision n’est intervenue. La demande sera instruite puis soumise à l’assemblée générale du 14 septembre 2027.</p>' +
      '<p>L’article 26 exige une délibération prise à la majorité des propriétaires représentant au moins les deux tiers de la superficie des propriétés. Les sept représentent 14 280 m² ; la base résiduelle serait de 90 366 m², soit une augmentation de 15,8 % des charges pour les quarante-quatre lots restants. Leur quote-part du fonds de travaux de 183 831,14 € s’élève à environ 25 084 €.</p>',
    entrees: [
      { date: '2025-03-12', titre: 'Consultation n° 1 — six des sept approuvent la méthode', contenu: 'Consultation sur le principe de modifier le cahier des charges à la double majorité plutôt qu’à l’unanimité. Clôturée le 12 mars 2025, approuvée par 82,0 % des colotis et 80,4 % des superficies. Six des sept colotis de la zone C l’ont approuvée.' },
      { date: '2025-06-19', titre: 'AGE — les sept s’abstiennent, aucun ne vote contre', contenu: 'Approbation des modifications du cahier des charges. Abstentions : 14 280 tantièmes, soit les sept propriétaires de la zone C. Le seul vote contre est celui de SCI Violette (2 326), qui n’appartient pas à la zone C.' },
      { date: '2026-09-15', titre: 'Remise de la déclaration commune des colotis de la zone C', contenu: 'Déclaration signée par les sept, remise avant l’ouverture des débats et la désignation du président de séance. Annexée aux conclusions du procès-verbal. Les signataires déclarent ne pas contester l’existence de l’ASL ni la nécessité de la mise en conformité, indiquent ne pas jouir des biens communs à l’exception de la plage à laquelle ils se déclarent prêts à renoncer, demandent l’ouverture d’une procédure de distraction collective et la précision des modalités de l’article 26, et indiquent que les frais seront portés par les demandeurs.' },
      { date: '2026-09-15', titre: 'Vote de la résolution 4 — les sept votent contre', contenu: 'Contre : 16 606 sur 104 646 tantièmes — Violette (2 326), Jeanlu (1 964), Gachoud Laetitia (1 526), Tkatchouk/Riabtchenkova (1 971), Deschamps Jaquier Nathalie (1 740), Kitka (2 468), Mathon Pierre et Josette (2 589), Hartwig-Ormyron Estelle (2 022). Pour : 72 854. Résolution adoptée. ⚠ Huit votants contre au total : les sept de la zone C (14 280 tantièmes) plus SCI Violette, qui n’en fait pas partie.' },
      { date: '2026-09-15', titre: 'Résolution 28 — la demande sera inscrite à l’ordre du jour de 2027', contenu: 'L’assemblée prend acte de la réception de la déclaration commune, qui sera inscrite à l’ordre du jour de la prochaine assemblée générale, fixée au 14 septembre 2027.' },
      { date: '2026-09-16', titre: 'Communication du conseil syndical à l’ensemble des colotis', contenu: '« Tous les frais inhérents à cette sortie, qu’elle aboutisse ou non, seront intégralement à la charge des sept propriétaires. » Et : « Jusqu’à la décision de l’assemblée, ces sept lots demeurent membres de l’ASL et restent redevables des charges dans les mêmes conditions que les autres. »' },
      { date: D, titre: 'Réponse commune des sept, via M. et Mme Hartwig', contenu: 'Réponse prenant acte d’une « ouverture officielle de la procédure », et rectification adressée par le conseil syndical. ⚠ Date à renseigner par Pascal — entrée créée à sa demande, le brief en signalait l’absence.' },
    ],
    pieces: [
      '3_procédures/Zone C/Lettre colotis zone C AG 2026.pdf',
      '4_ASL/10-zone C/3 scenarios.xlsx',
      '4_ASL/10-zone C/lettre demande de sortie.docx',
      '4_ASL/lettre M. Tkatchouk.pdf',
    ],
  },

  // ------------------------------------------------------------------ 1.3
  {
    titre: 'Réseau eaux pluviales — mémoire de l’association',
    categorie: 'Réseaux',
    resume:
      'Historique du réseau d’eaux pluviales du lotissement, des audits et des échanges avec la commune et Thonon Agglo. Le chantier de réfection relève du projet RESEAU EP.',
    contenu:
      '<p>Le réseau d’eaux pluviales du lotissement se déverse dans un collecteur communal de 800 mm qui passe sous l’allée privée (parcelle B228). L’état du réseau a fait l’objet d’un audit et d’une inspection visuelle. La résolution 10-2 de l’assemblée du 15 septembre 2026 a alloué 25 000 € à la conception et à l’appel d’offres, confiés à un maître d’œuvre ; le montant des travaux ne sera connu qu’au dépouillement des offres.</p>' +
      '<p>Interrogé en assemblée sur le caractère suffisant du fonds de travaux, le président a indiqué qu’un expert avait évoqué un ordre de grandeur de 350 000 € et que le montant total pourrait être de l’ordre de 500 000 €, ces chiffres ne constituant pas un budget.</p>',
    entrees: [
      { date: '2022-10-06', titre: 'Lettre à la mairie de Nernier', contenu: 'Courrier du lotissement à la mairie.' },
      { date: '2026-09-15', titre: 'Résolution 10-2 — 25 000 € pour la conception et l’appel d’offres', contenu: 'L’assemblée autorise l’appel de fonds destiné à l’expert chargé du design et de l’appel d’offres pour la réfection du réseau d’eaux pluviales.' },
      // ⚠ Les pièces du dossier EP n'ont pas de date connue. Plutôt que de les
      // laisser en commentaire (le brief) et de les perdre de vue, chacune devient
      // une entrée à la date sentinelle : elle apparaît au registre, se corrige, et
      // le rapport d'import la liste. Un commentaire dans un fichier source, lui,
      // n'aurait été lu par personne.
      { date: D, titre: 'Audit du réseau d’eaux pluviales', contenu: 'Pièce : 2034 Les Rives Nernier_Audit EP.pdf. ⚠ Date à renseigner.' },
      { date: D, titre: 'Rapport d’inspection visuelle du réseau', contenu: '⚠ Date à renseigner.' },
      { date: D, titre: 'Plans d’écoulement (version lotissement et version mairie)', contenu: '⚠ Date à renseigner.' },
      { date: D, titre: 'Plans Thonon Agglo', contenu: '⚠ Date à renseigner.' },
      { date: D, titre: 'Relevé EP au 500ème', contenu: 'Relevé daté de janvier 2021 selon le brief. ⚠ Jour à renseigner.' },
      { date: D, titre: 'Lettre du maire sur le réseau EP', contenu: '⚠ Date à renseigner.' },
    ],
    // Le dossier EP est parcouru en entier par le script (voir DOSSIERS_PIECES).
    pieces: ['4_ASL/Questions pour le maitre d’oeuvre.pdf'],
    dossiers: ['2_Réseau EP'],
  },

  // ------------------------------------------------------------------ 1.4
  {
    titre: 'Syndic et gestion',
    categorie: 'Gestion',
    resume: 'Convention de gestion, restitution des archives et points de vigilance sur les documents produits par le syndic.',
    contenu:
      '<p>La gestion de l’ASL est confiée à Foncia Lemanique par convention du 1er janvier au 31 décembre 2027, désignée par la résolution 7 de l’assemblée du 15 septembre 2026, le président étant mandaté pour la signer.</p>' +
      '<p>Le lotissement a été géré pendant des décennies comme une copropriété, ce qui explique plusieurs formulations erronées dans les documents du syndic. Les pièces antérieures à l’ASL sont conservées sur MyFoncia et doivent être exportées avant tout changement de syndic.</p>',
    entrees: [
      { date: '2026-09-15', titre: 'Résolution 7 — désignation de Foncia Lemanique', contenu: 'Convention de gestion du 1er janvier 2027 au 31 décembre 2027. Le président de séance est mandaté pour signer la convention. Adoptée à l’unanimité des exprimés.' },
      { date: '2026-09-15', titre: 'Discordance sur les 13 000 € du fonds plage', contenu: 'La résolution 10 du procès-verbal rattache 13 000 € à une « assemblée du 23 décembre 2022 ». Aucune assemblée ne s’est tenue à cette date : ces 13 000 € ont été votés par l’assemblée du 16 décembre 2023, qui l’écrit dans son propre texte. Erreur du syndic, à faire corriger.' },
    ],
    pieces: ['Syndic/Comparaison Syndics.pdf'],
  },

  // ------------------------------------------------------------------ 1.5
  {
    titre: 'Fonds travaux',
    categorie: 'Gestion',
    resume: 'Composition, nature juridique et affectation du fonds de travaux de 183 831,14 € transmis à l’ASL.',
    contenu:
      '<p>Au 31 mars 2026, le lotissement détient 183 831,14 € destinés au financement des travaux sur les biens communs : fonds de travaux 89 471,03 €, remise en fonction des portails 49 800,21 €, étude du nouveau réseau d’eaux pluviales 25 000 €, aménagement de la plage 20 159,90 € (dont 13 000 € votés le 16 décembre 2023 et 7 159,90 € en 2022), sous déduction de 600 € d’honoraires complémentaires sur les portails.</p>' +
      '<p>La résolution 10 du 15 septembre 2026 constate que ces sommes sont la propriété de l’association et « ne constituent ni une créance individuelle des colotis, ni un dépôt effectué pour leur compte ». Elles sont attachées aux lots et définitivement acquises à l’association : la quote-part d’un cédant est transmise de plein droit à l’acquéreur, et toute répartition convenue entre eux est inopposable à l’association.</p>',
    entrees: [
      { date: '2022-11-19', titre: 'Fonds plage initial — 7 159,90 €', contenu: 'Suppression de la rampe implantée sans titre sur le domaine fluvial, devis Part Bre du Léman retenu à 2 160 € TTC, et budget supplémentaire de 5 000 € pour l’aménagement de la plage. Appel de provisions de 7 160 € au 1er avril 2023.' },
      { date: '2023-12-16', titre: 'Étude de réaménagement et fonds complémentaire de 13 000 €', contenu: 'Étude confiée à RF Conseils pour 2 000 € TTC, phase 1. L’assemblée décide d’utiliser le fonds constitué de 7 159,90 € pour financer cette étude et de constituer un fonds supplémentaire de 13 000 € pour l’aménagement de la plage.' },
      { date: '2024-10-26', titre: 'État des fonds au 31 mars 2024', contenu: 'Fonds de travaux 122 497,75 €, fonds aménagement plage 20 159,90 €, fonds portail 51 363,51 €.' },
      { date: '2025-06-19', titre: 'AGE — confirmation du budget plage de 20 159,90 €', contenu: 'L’assemblée approuve l’utilisation du budget de 20 159,90 € pour la réhabilitation de la plage. Pour : 81 584 sur 88 275 tantièmes.' },
      { date: '2026-09-15', titre: 'Résolution 10 — le fonds est la propriété de l’association', contenu: '183 831,14 € transmis à l’ASL au titre de la mise en conformité des statuts. Ces sommes ne constituent ni une créance individuelle des colotis ni un dépôt effectué pour leur compte.' },
      { date: '2026-09-15', titre: 'Résolution 19 — dotation complémentaire de 100 000 €', contenu: 'Confirmation de la cotisation de 50 000 € votée le 19 janvier 2026 et non encore appelée, et dotation complémentaire de 50 000 € pour l’exercice 2026-2027. Appelées pour moitié le 30 septembre 2026 et pour le solde le 31 janvier 2027.' },
    ],
    pieces: [
      '4_ASL/Redistribution fonds travaux.pdf',
      '4_ASL/Restitution ou compensation fonds travaux.pdf',
    ],
  },

  // ------------------------------------------------------------------ 1.6
  {
    titre: 'Contentieux SCI Villa Aysha',
    categorie: 'Contentieux',
    resume: 'Second contentieux du lotissement, fondé sur le non-respect de l’article 15 de l’additif de 1957.',
    // ⚠ Volontairement VIDE : Pascal le rédigera (arbitrage du 2026-09-21). Le
    // sujet est créé pour que ses entrées et ses pièces aient où se ranger.
    contenu: '',
    entrees: [
      { date: '2025-10-07', titre: 'Ordonnance de référé obtenue par Me Raimond', contenu: 'L’ordonnance a été notifiée à l’avocat adverse ainsi qu’à la partie concernée. Le décompte des sommes dues à l’ASL a été transmis à l’avocat adverse, sans retour malgré relance.' },
      { date: '2026-09-15', titre: 'Résolution 25 — point d’information', contenu: '⚠ La convocation et le procès-verbal désignent la société sous le nom « SCI Aicha ». La dénomination employée par toutes les assemblées de 2019 à 2023, et par la résolution 9 du même procès-verbal, est SCI Villa Aysha.' },
    ],
    pieces: [],
  },

  // ------------------------------------------------------------------ 1.7
  {
    titre: 'Assurances',
    categorie: 'Gestion',
    resume: 'Responsabilité civile et protection juridique couvrant l’activité du Conseil syndical, prévues par l’article 16 des statuts.',
    contenu:
      '<p>L’article 16 des statuts dispose que « le lotissement souscrit une assurance responsabilité civile et protection juridique couvrant l’activité du Conseil syndical ». L’existence, le contenu et l’étendue de cette police restent à vérifier auprès du syndic. Le volet protection juridique conditionne la capacité de l’association à financer une défense sans appel de fonds spécifique.</p>',
    entrees: [],
    pieces: [],
  },

  // ------------------------------------------------------------------ 1.8
  {
    titre: 'Urbanisme et servitudes',
    categorie: 'Urbanisme',
    resume: 'Plan local d’urbanisme, domaine public fluvial, haies et servitudes affectant le lotissement.',
    contenu: '', // ⚠ Volontairement vide : à rédiger par Pascal.
    entrees: [
      { date: D, titre: 'Lettre de la DDT', contenu: 'Datée de 2021 selon le brief. ⚠ Jour et mois à renseigner.' },
      { date: D, titre: 'Photos des haies et des panneaux endommagés', contenu: '⚠ Date à renseigner.' },
      { date: D, titre: 'Modifications parcellaires Luscher / Van Den Berg', contenu: '⚠ Date à renseigner.' },
    ],
    pieces: [
      'PLU/reglement PLU.pdf',
      'PLU/plan_zonage.pdf',
      'DDT/Lettre DDT 2021.pdf',
    ],
  },
]

// ---------------------------------------------------------------- existants
// Pièces à rattacher à des sujets DÉJÀ EN BASE — on ne recrée pas le sujet, on
// complète ses pièces jointes.
//
// ⚠ Le brief donnait `1956 février-Annexe I (arbres & plage).pdf` : ce fichier
// n'existe pas sous ce nom. Le vrai est `1956 février-Annexe I (plage).pdf`,
// vérifié sur le disque. Corrigé ici plutôt que signalé comme introuvable.
export const PIECES_SUJETS_EXISTANTS = {
  'Statut juridique du lotissement': [
    '4_ASL/3-cahier des charges/1955 août-cahier des charges.pdf',
    '4_ASL/3-cahier des charges/1956 février-Annexe I (plage).pdf',
    '4_ASL/3-cahier des charges/1957 janvier-Annexe II (propriété allées).pdf',
    '4_ASL/0-Modification du CdC/ADDENDUM III suite au vote du 17_avril:_2025 v3.pdf',
    '4_ASL/0-Modification du CdC/Lotissement_Rives_Note_Synthese_v13.pdf',
    '4_ASL/8-avocat/MEMO Avocats 24:1:25.pdf',
    '4_ASL/8-avocat/Réponses Avocats 6:2:25.pdf',
  ],
}

// ---------------------------------------------------------------- corrections
// Coquilles relevées dans le brief et VÉRIFIÉES présentes dans l'export du
// 2026-09-18. Chacune est une substitution de texte, appliquée uniquement si la
// chaîne cherchée est présente — pas de réécriture à l'aveugle d'un registre.
export const CORRECTIONS = [
  { table: 'sujet_entrees', champ: 'titre', cherche: 'démantrant', remplace: 'démontrant', note: 'Sujet Plage, entrée du 19/06/2023' },
  { table: 'sujet_entrees', champ: 'contenu', cherche: 'Ktatchouk', remplace: 'Tkatchouk', note: 'Sujet Statut juridique, entrée du 05/03/2025' },
  { table: 'proprietaires', champ: 'nom', cherche: 'Gachoud Leatitia', remplace: 'Gachoud Laetitia', note: 'Registre des propriétaires' },
]

// ⚠ « ORMYRON ESTELLE » N'EST PAS CORRIGÉ, et c'est délibéré. Le brief le signale
// lui-même : « sauf s'il s'agit de la citation littérale du procès-verbal ». Or
// l'entrée du 19/06/2025 cite le dépouillement du vote mot pour mot. Harmoniser
// un nom à l'intérieur d'une citation, c'est réécrire un procès-verbal. Laissé
// tel quel, à trancher par Pascal sur pièce.
