// ============================================================================
// MANUEL DE L'UTILISATEUR — organisé par ENTRÉE DE MENU
//
// ⚠ L'organisation par MENU et non par rôle est un choix de Pascal (2026-09-03),
// et il est juste : on n'ouvre pas un manuel en se demandant « que puis-je en
// tant que trésorier ? », mais « je suis sur cet écran, comment je fais telle
// chose ? ». Le rôle ne sert plus qu'à FILTRER — on ne voit que les menus et les
// actions qui nous sont ouverts.
//
// Chaque action se déplie en pas-à-pas. Une action qu'on sait faire ne doit pas
// encombrer : replié par défaut, déplié à la demande.
//
// Contenu VERSIONNÉ avec le code, jamais en base : il décrit ce que
// l'application fait, donc il change quand elle change.
//
// ⚠ RÈGLE D'ÉCRITURE : ne décrire que ce qui est VRAI dans le code. Un manuel
// qui promet un bouton inexistant est pire que pas de manuel.
// ============================================================================

/** Ouvert à tout membre actif du conseil, quel que soit son rôle. */
export const TOUS = 'tous'

/**
 * Un membre voit-il cette action ?
 *
 * ⚠ `pourQui` liste les rôles du BUREAU (`membres_cs.role`). Le président est
 * traité à part parce qu'il garde tout : la RLS lui ouvre l'écriture partout
 * (`write_admin`), donc le manuel doit le refléter.
 */
export function accessible(pourQui, role, isAdmin) {
  if (pourQui === TOUS) return true
  if (isAdmin) return true
  return Array.isArray(pourQui) && pourQui.includes(role)
}

// ============================================================================
// LES MENUS, dans l'ordre où ils apparaissent dans la barre de gauche.
// `visiblePar` reproduit exactement le filtrage de `Layout.jsx` : le manuel ne
// doit pas décrire un écran que le lecteur ne voit pas.
// ============================================================================
export const MENUS = [
  {
    cle: 'registre',
    menu: 'Décisions CS',
    visiblePar: TOUS,
    aQuoi:
      'Le registre légal des délibérations du conseil. C’est le cœur de l’application : tout le reste existe pour l’alimenter ou l’éclairer.',
    // ⚠ `noteAcces` s'adresse à CEUX QUI N'ONT PAS TOUS LES DROITS sur l'écran.
    // Elle remplace la liste grisée des actions interdites (arbitrage Pascal,
    // 2026-09-03) : une colonne de titres barrés encombre sans rien expliquer,
    // une phrase dit ce qu'on peut faire et pourquoi le reste est réservé.
    noteAcces:
      'Vous pouvez tout faire ici, sauf deux actes réservés au président : enregistrer une délibération — son inscription définitive au registre, au sens de l’article 15 — et décider si une décision est communicable aux colotis.',
    actions: [
      {
        titre: 'Créer une décision',
        pourQui: TOUS,
        resume: 'Rédiger un projet de délibération, seul et sans être vu.',
        etapes: [
          'Cliquez sur « Nouvelle décision ».',
          'Donnez un titre court et explicite : c’est lui qui apparaîtra au registre.',
          'Rédigez le corps de la décision — ce sur quoi le conseil va se prononcer.',
          'Si la décision engage de l’argent, choisissez la cible (un projet ou une résolution d’AG) et saisissez le montant du devis, le taux de TVA, et si le montant est HT ou TTC.',
          'Joignez les pièces utiles : devis, plan, courrier.',
          'Enregistrez. La décision reste un BROUILLON, visible de vous seul.',
        ],
        alerte:
          'Tant qu’elle est en brouillon, personne ne la voit — pas même le président. Vous pouvez la reprendre autant de fois qu’il le faut.',
      },
      {
        titre: 'Soumettre une décision au vote',
        pourQui: TOUS,
        resume: 'Ouvrir le vote. C’est irréversible : le texte se fige.',
        etapes: [
          'Ouvrez votre brouillon, vérifiez une dernière fois le titre et le corps du texte.',
          'Cliquez sur « Soumettre au vote ».',
          'La décision reçoit son numéro d’ordre (2026-014) et devient visible de tous les membres.',
          'La date limite de réponse est calculée automatiquement en jours ouvrés.',
          'Prévenez le conseil (voir l’action suivante) : rien ne part tout seul.',
        ],
        alerte:
          'À partir de là, le titre et le corps du texte NE SE MODIFIENT PLUS, même pour vous. Le montant, le rattachement et les pièces jointes restent modifiables jusqu’à l’enregistrement.',
      },
      {
        titre: 'Planifier l’ouverture du vote',
        pourQui: TOUS,
        resume: 'Faire ouvrir le vote plus tard, tout seul.',
        etapes: [
          'Dans le formulaire de la décision, indiquez une date de soumission.',
          'Enregistrez : la décision reste un brouillon privé jusqu’à cette date.',
          'Le jour dit, elle s’ouvre seule au vote et reçoit son numéro.',
        ],
        alerte:
          'Utile pour qu’un vote ait lieu après une assemblée, avec le conseil qui en sortira : c’est la composition du jour de l’ouverture qui est appelée à voter.',
      },
      {
        titre: 'Voter',
        pourQui: TOUS,
        resume: 'Pour, contre ou abstention.',
        etapes: [
          'Ouvrez la décision depuis le registre.',
          'Choisissez Pour, Contre ou Abstention.',
          'Votre vote est enregistré immédiatement ; vous pouvez le changer tant que la décision n’est pas enregistrée.',
        ],
        alerte:
          'L’abstention n’est pas neutre : elle compte parmi les présents et rend l’adoption plus difficile. Ne pas voter du tout, c’est être absent.',
      },
      {
        titre: 'Prévenir le conseil qu’une décision attend leur vote',
        pourQui: TOUS,
        resume: 'Envoyer le message au groupe. Manuel, jamais automatique.',
        etapes: [
          'Ouvrez la décision soumise au vote.',
          'Cliquez sur « Prévenir le CS ».',
          'Un message pré-rédigé s’ouvre dans WhatsApp : choisissez le groupe du conseil et envoyez.',
          'Le bouton devient « Notifier à nouveau » — utile pour une relance.',
        ],
        alerte:
          'L’application n’avertit personne d’elle-même. Sans ce geste, une décision peut rester ouverte sans que quiconque le sache.',
      },
      {
        titre: 'Poser une question, répondre',
        pourQui: TOUS,
        resume: 'Le fil d’échanges attaché à la décision.',
        etapes: [
          'En bas de la fiche de la décision, écrivez votre question.',
          'Chacun peut y répondre ; le fil reste attaché à la décision.',
        ],
      },
      {
        titre: 'Enregistrer une décision — l’acte',
        pourQui: ['president'],
        resume: 'Figer le résultat et l’inscrire au registre.',
        etapes: [
          'Vérifiez que le quorum est atteint : l’écran l’indique.',
          'Vérifiez le résultat calculé (adoptée ou rejetée) : l’application applique l’article 15, vous ne choisissez pas.',
          'Cliquez sur « Enregistrer la décision ».',
          'La composition du conseil au jour du vote est figée avec elle, pour que le PDF reste fidèle après un changement de mandat.',
        ],
        alerte:
          'IRRÉVERSIBLE. Une décision enregistrée ne se modifie plus, ne se vote plus, ne se supprime plus. C’est le verrou de l’article 15.',
      },
      {
        titre: 'Annuler une décision',
        pourQui: TOUS,
        resume: 'Retirer une décision en laissant la trace.',
        etapes: [
          'Ouvrez la décision (avant l’ouverture du vote).',
          'Cliquez sur « Annuler » et saisissez le motif — il est obligatoire.',
          'La décision reste au registre avec la mention ANNULÉE et son motif.',
        ],
        alerte:
          'Annuler n’est pas supprimer. Annuler garde la trace ; supprimer n’en laisse aucune. Devant un registre légal, une décision retirée doit se voir.',
      },
      {
        titre: 'Supprimer une décision',
        pourQui: TOUS,
        resume: 'Effacer sans trace — seulement avant le vote.',
        etapes: [
          'Votre propre brouillon : ouvrez-le et cliquez sur « Supprimer ». Aucun numéro n’ayant été attribué, il ne laisse aucun trou dans le registre.',
          'Une décision déjà soumise : seul le président peut la supprimer, et seulement si personne n’a encore voté.',
        ],
      },
      {
        titre: 'Changer la visibilité aux colotis',
        pourQui: ['president'],
        resume: 'Décider si une décision est réservée au conseil.',
        etapes: [
          'Ouvrez la décision — même enregistrée.',
          'Changez la visibilité : réservée au conseil, ou ouverte aux colotis.',
          'Le changement est tracé dans le journal d’audit.',
        ],
        alerte:
          'Publier n’est pas délibérer : le verrou de l’article 15 protège le TEXTE, pas son audience. C’est pourquoi ce réglage reste ouvert après l’enregistrement.',
      },
      {
        titre: 'Exporter le registre en PDF',
        pourQui: TOUS,
        resume: 'Le registre complet, ou une décision seule.',
        etapes: [
          'Depuis le registre : « Exporter le PDF » produit le registre complet avec son sommaire.',
          'Depuis une décision : le PDF de cette seule délibération, avec les lignes de signature.',
        ],
        alerte:
          'Les brouillons et les décisions planifiées sont exclus du PDF : ce ne sont pas des délibérations. Les annulées y figurent, avec la mention ANNULÉE.',
      },
    ],
  },

  {
    cle: 'ag',
    menu: 'Assemblées Générales',
    visiblePar: TOUS,
    aQuoi:
      'Les assemblées et leurs résolutions. C’est l’AG qui vote les budgets ; le conseil ne fait que les engager.',
    noteAcces:
      'Cet écran est en lecture seule pour vous. Le président et le secrétaire tiennent les assemblées — convocation, résolutions, numérotation, résultats — parce que ces éléments doivent correspondre au procès-verbal, dont le secrétaire répond.',
    actions: [
      {
        titre: 'Consulter une assemblée',
        pourQui: TOUS,
        resume: 'Résolutions, budgets votés, convocation et procès-verbal.',
        etapes: [
          'Ouvrez l’assemblée depuis la liste.',
          'Les résolutions sont classées par leur numéro de convocation, avec leur statut et le budget alloué.',
          'La convocation et le PV sont en pièces jointes de l’assemblée elle-même.',
          'Les projets financés par une résolution sont indiqués en regard.',
        ],
      },
      {
        titre: 'Créer une assemblée',
        pourQui: ['secretaire'],  // + président, via write_admin
        resume: 'Avant qu’elle ait lieu, dès la convocation.',
        etapes: [
          'Cliquez sur « Nouvelle AG ».',
          'Saisissez le type, la date, l’heure et le lieu.',
          'Laissez le président de séance VIDE : il est désigné en séance, l’inventer écrirait une information fausse.',
        ],
      },
      {
        titre: 'Ajouter une résolution',
        pourQui: ['secretaire'],  // + président, via write_admin
        resume: 'Une ligne de l’ordre du jour, avec son budget éventuel.',
        etapes: [
          'Ouvrez l’AG, puis « Ajouter une résolution ».',
          'Reprenez le NUMÉRO DE LA CONVOCATION, pas l’ordre de saisie.',
          'Si une résolution du PV finance plusieurs projets, utilisez la sous-numérotation : 10-1, 10-2, 10-3.',
          'Indiquez le budget alloué s’il y en a un, et la majorité requise.',
          'Le statut par défaut est « à voter » — il passera à adoptée ou rejetée après l’assemblée.',
        ],
        alerte:
          'Seule une résolution ADOPTÉE alloue réellement un budget. Une résolution à voter, rejetée ou retirée n’alloue rien : son montant n’est qu’une proposition.',
      },
      {
        titre: 'Joindre la convocation ou le procès-verbal',
        pourQui: ['secretaire'],  // + président, via write_admin
        resume: 'Les pièces de l’assemblée elle-même.',
        etapes: [
          'Ouvrez l’AG, section pièces jointes.',
          'Choisissez la catégorie : convocation, PV, ou autre.',
          'Déposez le fichier.',
        ],
        alerte:
          'Possible même sur une AG clôturée, et c’est voulu : le PV arrive toujours après la séance.',
      },
      {
        titre: 'Affecter une enveloppe votée à un projet',
        pourQui: ['secretaire'],  // + président, via write_admin
        resume: 'L’AG vote, le conseil affecte.',
        etapes: [
          'Ouvrez l’AG et repérez la résolution dotée d’un budget.',
          'Cliquez sur « Ouvrir un projet » (le projet est créé et rattaché) ou « Rattacher à un projet existant ».',
          'Le budget du projet devient la somme des enveloppes qui le pointent.',
        ],
        alerte:
          'Le rattachement se pilote depuis l’AG, jamais depuis le projet : c’est la résolution qui désigne son projet. Une enveloppe rattachée y passe en entier.',
      },
      {
        titre: 'Saisir les résultats du vote',
        pourQui: ['secretaire'],  // + président, via write_admin
        resume: 'Après l’assemblée, résolution par résolution.',
        etapes: [
          'Passez chaque résolution en adoptée, rejetée ou retirée.',
          'Saisissez le nombre de voix tel qu’il figure au PV.',
        ],
        alerte:
          'L’application ne compte AUCUNE voix d’AG : les votes sont au prorata des superficies et restent l’affaire du PV. Elle n’enregistre que le résultat.',
      },
      {
        titre: 'Valider les comptes de l’exercice',
        pourQui: ['tresorier', 'president'],
        resume: 'À deux : trésorier et président.',
        etapes: [
          'Ouvrez l’AG, section comptes.',
          'Approuvez les comptes.',
          'Ils ne sont réputés validés que lorsque le trésorier ET le président l’ont fait.',
        ],
      },
    ],
  },

  {
    cle: 'projets',
    menu: 'Projets',
    visiblePar: TOUS,
    aQuoi:
      'Les chantiers du conseil. Un projet dépense une enveloppe votée en assemblée — il ne crée pas d’argent.',
    noteAcces:
      'Vous pouvez créer un projet — vous en devenez alors le chef — et tenir le journal de n’importe quel projet. En revanche, seuls le chef, son adjoint et le président modifient la fiche d’un projet existant.',
    actions: [
      {
        titre: 'Créer un projet',
        pourQui: TOUS,
        resume: 'Le plus souvent depuis l’AG, pas depuis ici.',
        etapes: [
          'Le chemin normal : depuis la fiche de l’AG, « Ouvrir un projet » sur la résolution qui le finance.',
          'Depuis cet écran, « Nouveau projet » crée un projet sans budget — à rattacher ensuite depuis l’AG.',
          'Renseignez le titre, la description, les dates d’ouverture et de fin prévue.',
        ],
        alerte:
          'Le budget n’est jamais saisi : il découle des résolutions adoptées qui pointent le projet. Un projet à 0 € est un projet sans enveloppe rattachée.',
      },
      {
        titre: 'Désigner le chef de projet et son adjoint',
        // Le chef, son adjoint, ou le président (`projets_chef_update`).
        pourQui: ['secretaire', 'tresorier', 'membre'],
        resume: 'Qui pilote, et qui prend le relais.',
        etapes: [
          'Ouvrez le projet, puis « Modifier ».',
          'Choisissez le chef de projet parmi les membres du conseil, et son adjoint.',
          'Les deux ont exactement les mêmes possibilités : l’adjoint existe pour que le projet ne s’arrête pas en cas d’absence.',
        ],
      },
      {
        titre: 'Tenir le journal de bord',
        pourQui: TOUS,
        resume: 'Ce qui a été fait, avec la date réelle.',
        etapes: [
          'Ouvrez le projet, section journal.',
          'Saisissez la date à laquelle la chose s’est passée — pas celle où vous l’écrivez.',
          'Décrivez en une ligne : visite, appel, courrier, réunion.',
        ],
        alerte:
          'Chacun corrige et supprime ses propres lignes. Le chef de projet ne réécrit pas le compte rendu d’un autre.',
      },
      {
        titre: 'Suspendre, reprendre ou terminer un projet',
        pourQui: TOUS,
        resume: 'Il n’y a pas de bouton : c’est une décision.',
        etapes: [
          'Créez une décision qui cible le projet.',
          'Dans « Effet sur le projet », choisissez suspendre, reprendre ou terminer.',
          'Soumettez au vote ; l’effet ne se produit qu’à l’enregistrement, décision adoptée.',
        ],
        alerte:
          'Aucun bouton n’existe, volontairement. Ces trois transitions sont des délibérations du conseil : ni le chef de projet, ni l’adjoint, ni le président ne les décident seuls.',
      },
    ],
  },

  {
    cle: 'budgets',
    menu: 'Budgets',
    visiblePar: TOUS,
    aQuoi: 'Ce qui a été voté, ce qui est engagé, ce qui reste — par assemblée et par projet.',
    actions: [
      {
        titre: 'Lire les budgets consolidés',
        pourQui: TOUS,
        resume: 'Alloué, engagé, restant.',
        etapes: [
          'L’écran présente chaque assemblée, ses résolutions dotées et les projets qu’elles financent.',
          'L’engagé ne compte que les décisions ENREGISTRÉES et ADOPTÉES : une décision en cours de vote n’engage rien.',
        ],
      },
      {
        titre: 'Exporter le CSV pour le syndic',
        pourQui: TOUS,
        resume: 'Le fichier attendu par Foncia.',
        etapes: [
          'Cliquez sur « Exporter CSV ».',
          'Le fichier utilise le point-virgule et la virgule décimale : il s’ouvre directement dans Excel en français.',
        ],
      },
    ],
  },

  {
    cle: 'memoire',
    menu: 'Mémoire',
    visiblePar: TOUS,
    aQuoi:
      'La mémoire du lotissement, dossier par dossier : le portail, la zone C, le recouvrement. Elle porte le POURQUOI, que le registre des décisions ne conserve pas.',
    actions: [
      {
        titre: 'Créer un sujet',
        pourQui: TOUS,
        resume: 'Un par dossier qui revient d’une année sur l’autre.',
        etapes: [
          'Saisissez le titre du dossier et choisissez une catégorie.',
          'Un titre par dossier, et un seul : deux sujets « Portail » couperaient la mémoire en deux.',
        ],
      },
      {
        titre: 'Écrire la synthèse',
        pourQui: TOUS,
        resume: 'Où en est-on aujourd’hui.',
        etapes: [
          'Ouvrez le sujet, « Modifier la synthèse ».',
          'Le résumé d’une ligne apparaît dans la liste ; la synthèse développe.',
          'Écrivez pour quelqu’un qui arrive : ce qui a été décidé, et surtout pourquoi.',
        ],
        alerte:
          'Consignez aussi les impasses. Savoir qu’une piste a été écartée, et pour quelle raison, évite de la reprendre dans trois ans.',
      },
      {
        titre: 'Ajouter une entrée à la chronologie',
        pourQui: TOUS,
        resume: 'Un fait, à sa date.',
        etapes: [
          'Ouvrez le sujet, « Ajouter une entrée ».',
          'Indiquez la date à laquelle la chose s’est passée.',
          'Décrivez le fait : une réunion, un courrier, un refus, un devis.',
          'Citez les décisions par leur numéro : le registre en garde le texte exact.',
        ],
      },
    ],
  },

  {
    cle: 'signatures',
    menu: 'Signatures',
    visiblePar: ['president', 'secretaire'],
    aQuoi:
      'La signature du registre par les membres présents à la délibération (art. 15).',
    actions: [
      {
        titre: 'Ouvrir un lot de signature',
        pourQui: ['president', 'secretaire'],
        resume: 'Regrouper les décisions à faire signer.',
        etapes: [
          'Sélectionnez les décisions enregistrées à faire signer.',
          'Les signataires sont TOUS les membres présents à la délibération — y compris ceux qui ont voté contre.',
          'Les absents n’ont pas de ligne de signature.',
        ],
        alerte:
          'La signature électronique est aujourd’hui une simulation : le module réel n’est pas encore raccordé. Les signatures sur papier restent nécessaires.',
      },
    ],
  },

  {
    cle: 'membres',
    menu: 'Membres du CS',
    visiblePar: TOUS,
    aQuoi: 'La composition du conseil et les rôles du bureau.',
    noteAcces:
      'Cet écran est en lecture seule pour vous. Seul le président ajoute un membre, lui attribue un rôle du bureau ou le désactive : la composition du conseil détermine le quorum et la validité des votes.',
    actions: [
      {
        titre: 'Consulter la composition du conseil',
        pourQui: TOUS,
        resume: 'Qui siège, depuis quand, avec quel rôle.',
        etapes: ['La liste montre les membres actifs, leur rôle et leur date d’élection.'],
      },
      {
        titre: 'Ajouter un membre',
        pourQui: ['president'],
        resume: 'À l’issue d’une élection.',
        etapes: [
          'Cliquez sur « Ajouter un membre ».',
          'Saisissez le nom, le prénom et l’ADRESSE E-MAIL exacte : c’est elle qui lie la fiche au compte de connexion.',
          'Renseignez la date d’élection et l’AG qui l’a élu.',
          'Créez ensuite son compte de connexion dans Supabase, avec la même adresse.',
        ],
        alerte:
          'L’adresse doit correspondre au caractère près entre la fiche et le compte, sinon la personne se connecte sans être reconnue comme membre.',
      },
      {
        titre: 'Attribuer un rôle du bureau',
        pourQui: ['president'],
        resume: 'Président, trésorier, secrétaire.',
        etapes: [
          'Ouvrez la fiche du membre et choisissez son rôle.',
          'Ces trois rôles sont à titulaire unique : un seul président, un seul trésorier, un seul secrétaire à la fois.',
        ],
        alerte:
          'Le rôle de président transfère les droits d’administration. Le président de l’application suit le mandat, pas la personne.',
      },
      {
        titre: 'Désactiver un membre',
        pourQui: ['president'],
        resume: 'Fin de mandat.',
        etapes: [
          'Ouvrez la fiche et décochez « actif ».',
          'Il ne compte plus dans le quorum et ne peut plus voter, mais ses votes passés restent au registre.',
        ],
      },
    ],
  },

  {
    cle: 'proprietaires',
    menu: 'Propriétaires',
    visiblePar: ['president', 'secretaire'],
    aQuoi:
      'Le registre des membres de l’ASL : parcelles, superficies, propriétaires et coordonnées.',
    actions: [
      {
        titre: 'Consulter le registre',
        pourQui: ['president', 'secretaire'],
        resume: 'La liste des parcelles et de leurs propriétaires.',
        etapes: [
          'La liste affiche la parcelle et sa surface, l’adresse du bien, l’adresse de communication, le propriétaire et le mandataire.',
          'Cliquez sur les intitulés de colonne pour changer le tri ; il est retenu d’une fois sur l’autre.',
          'Les lignes en jaune pâle sont des sociétés.',
        ],
        alerte:
          'DONNÉES PERSONNELLES DE TIERS. Seuls le nom, l’adresse dans le lotissement et la parcelle sont communicables. Toute autre divulgation engage votre responsabilité personnelle.',
      },
      {
        titre: 'Compléter une fiche',
        pourQui: ['president', 'secretaire'],
        resume: 'Coordonnées, dirigeants, mandataire.',
        etapes: [
          'Ouvrez la parcelle depuis la liste.',
          'Renseignez la superficie — elle sert d’assiette aux voix en AG et aux charges.',
          'Pour une société, nommez ses dirigeants ; pour un colotis injoignable, son mandataire.',
          'Les flèches ← → ou celles du clavier passent à la parcelle suivante, dans l’ordre du tri.',
        ],
      },
      {
        titre: 'Choisir les destinataires des convocations',
        pourQui: ['president', 'secretaire'],
        resume: 'Plusieurs personnes, pas une seule.',
        etapes: [
          'Sur la fiche, cochez les sources : le propriétaire, le second propriétaire, les dirigeants, le mandataire.',
          'L’encart « Recevront la convocation » montre exactement ce qui partira.',
          'Une case sans coordonnées est signalée « sans coordonnées » : elle ne produit aucun destinataire.',
        ],
        alerte:
          'On convoque tous ceux qui doivent l’être : les deux indivisaires, l’usufruitier et le nu-propriétaire, le dirigeant et son mandataire sur place.',
      },
      {
        titre: 'Enregistrer une mutation',
        pourQui: ['president', 'secretaire'],
        resume: 'Un changement de propriétaire.',
        etapes: [
          'Sur la fiche, cliquez sur « Enregistrer une mutation ».',
          'Saisissez la DATE DE L’ACTE : elle clôt la période de l’ancien propriétaire et ouvre celle du nouveau.',
          'Renseignez le nouveau propriétaire et ses coordonnées.',
        ],
        alerte:
          'N’enregistrez pas une mutation sans sa date réelle : ce sont les bornes de période qui font la valeur de l’historique. Mieux vaut un registre en retard qu’un registre faux.',
      },
    ],
  },

  {
    cle: 'parametres',
    menu: 'Paramètres',
    visiblePar: TOUS,
    aQuoi: 'Votre compte et vos préférences.',
    actions: [
      {
        titre: 'Changer votre mot de passe',
        pourQui: TOUS,
        resume: 'Huit caractères minimum.',
        etapes: [
          'Saisissez le nouveau mot de passe et confirmez-le.',
          'À la première connexion, ce changement est obligatoire avant d’accéder au reste.',
        ],
      },
    ],
  },
]

// ============================================================================
// PARCOURS TRANSVERSAUX
//
// Certaines tâches traversent plusieurs menus : elles n'ont donc de place dans
// aucun. Conduire un projet en est le cas type — cela va de l'enveloppe votée en
// assemblée à la facture payée, en passant par une décision du conseil.
// ============================================================================
export const PARCOURS = [
  {
    cle: 'conduire_projet',
    titre: 'Conduire un projet, de l’enveloppe à la facture',
    pourQui: TOUS,
    resume:
      'À lire si vous êtes chef de projet ou adjoint. L’ordre compte : commander avant l’enregistrement, c’est engager l’association sans mandat.',
    etapes: [
      {
        titre: 'Vérifier l’enveloppe',
        texte:
          'Ouvrez la fiche du projet : le budget alloué y figure. Il n’est jamais saisi — c’est la somme des résolutions d’assemblée adoptées qui pointent ce projet. S’il affiche zéro, aucune enveloppe n’a été rattachée : cela se corrige depuis la fiche de l’AG, pas depuis le projet.',
      },
      {
        titre: 'Tenir le journal dès le premier jour',
        texte:
          'Chaque visite, appel, courrier, réunion. Avec la date à laquelle la chose s’est passée. C’est ce journal qui permettra, dans deux ans, de savoir pourquoi telle entreprise a été écartée.',
      },
      {
        titre: 'Consulter plusieurs fournisseurs',
        texte:
          'Demandez plusieurs devis. Consignez au journal qui a répondu, à quel prix, ce que le devis comprend et ce qu’il exclut. Joignez les devis au projet.',
      },
      {
        titre: 'Rédiger la décision qui engage la dépense',
        texte:
          'C’est le seul moyen d’engager de l’argent. Créez une décision, cible « Projet », puis votre projet. L’écran affiche alloué, déjà engagé et restant. Saisissez le montant du devis retenu, le taux de TVA, et si le montant est HT ou TTC : l’application calcule le coût TTC et prévient en rouge s’il dépasse le disponible.',
        alerte:
          'La description doit expliquer le CHOIX, pas seulement le montant : quelles entreprises ont été consultées, pourquoi celle-ci. Le texte sera figé à la soumission — c’est lui qui restera au registre.',
      },
      {
        titre: 'Joindre le devis retenu, puis soumettre',
        texte:
          'Le devis qui fonde la décision doit y être avant la soumission. Puis soumettez au vote et prévenez le conseil : rien ne part automatiquement.',
        alerte:
          'Une décision qui engage de l’argent n’est adoptée que si le trésorier OU le président a voté pour. La majorité seule ne suffit pas.',
      },
      {
        titre: 'Attendre l’enregistrement avant de commander',
        texte:
          'Tant que la décision n’est pas enregistrée par le président, rien n’est engagé : le montant n’apparaît dans aucun budget et le fournisseur ne doit pas être commandé.',
      },
      {
        titre: 'Suivre l’exécution, puis clore',
        texte:
          'Journal : commande, acompte, chantier, réception, réserves. Factures jointes au projet. Pour terminer le projet, créez une décision avec « Effet sur le projet : terminer » — il n’y a pas de bouton.',
      },
    ],
  },
]

// ============================================================================
// CE QUE PERSONNE NE PEUT FAIRE
//
// Les limites qui ne dépendent d'aucun rôle. Elles sont ici parce qu'un nouveau
// membre les prend systématiquement pour des pannes.
// ============================================================================
export const LIMITES_COMMUNES = [
  {
    titre: 'Rien ne s’adopte tout seul',
    texte:
      'Le vote ne se clôt pas à l’échéance. La date limite informe, elle ne décide pas : il faut que le président enregistre la délibération pour que le résultat existe.',
  },
  {
    titre: 'Personne ne vote pour un autre',
    texte:
      'La représentation — « ou représentés », dans les statuts — n’est pas gérée par l’application. Un membre sans vote est absent, jamais représenté.',
  },
  {
    titre: 'L’abstention fait obstacle',
    texte:
      'L’adoption exige la majorité des membres PRÉSENTS, et un abstentionniste est présent. S’abstenir n’est donc pas neutre.',
  },
  {
    titre: 'Un quorum plus strict que les statuts',
    texte:
      'Il faut que plus de la moitié des membres actifs aient voté. Les statuts n’imposent aucun quorum au conseil : c’est une exigence que le conseil s’est donnée.',
  },
  {
    titre: 'Aucun envoi automatique',
    texte:
      'L’application ne prévient personne d’elle-même, ni à l’ouverture d’un vote ni à l’enregistrement. C’est à l’auteur de prévenir le conseil.',
  },
  {
    titre: 'Pas de saisie depuis un téléphone',
    texte:
      'Sur mobile, l’application est en consultation et en vote. La saisie se fait sur ordinateur : un registre légal se relit avant d’être écrit.',
  },
]

/**
 * Les menus visibles par ce lecteur, avec les seules actions qui lui sont
 * ouvertes. Un menu dont aucune action n'est accessible disparaît : le manuel ne
 * doit décrire que ce que la personne voit et peut faire.
 */
export function manuelPour(role, isAdmin) {
  return MENUS
    .filter((m) => accessible(m.visiblePar, role, isAdmin))
    .map((m) => ({
      ...m,
      actions: m.actions.filter((a) => accessible(a.pourQui, role, isAdmin)),
      // ⚠ On ne liste PAS les actions interdites : une colonne de titres grisés
      // encombre sans rien expliquer. On affiche la note d'accès de l'écran, et
      // seulement si le lecteur y est effectivement bridé.
      note: m.actions.some((a) => !accessible(a.pourQui, role, isAdmin)) ? m.noteAcces || null : null,
    }))
  // ⚠ On ne retire PAS un écran dont aucune action n'est ouverte : il reste
  // visible dans le menu, donc lisible, et le manuel doit dire à quoi il sert.
  // Le supprimer laisserait le lecteur devant un écran que rien n'explique.
}

/** Les parcours transversaux ouverts à ce lecteur. */
export function parcoursPour(role, isAdmin) {
  return PARCOURS.filter((p) => accessible(p.pourQui, role, isAdmin))
}
