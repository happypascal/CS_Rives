// ============================================================================
// MANUEL DE L'UTILISATEUR, par rôle
//
// Contenu VERSIONNÉ avec le code, et non stocké en base : il décrit ce que
// l'application fait, donc il change quand elle change. Une aide en base
// dériverait du produit sans que rien ne le signale — c'est précisément ce
// qu'on reproche à une documentation.
//
// ⚠ RÈGLE D'ÉCRITURE : ne décrire que ce qui est VRAI dans le code. Un manuel
// qui promet un pouvoir inexistant est pire que pas de manuel — le lecteur
// cherche un bouton qui n'existe pas et conclut que l'application est cassée.
// Deux pièges vérifiés dans le code avant d'écrire ces lignes :
//   - le TRÉSORIER a un vrai pouvoir (la garde d'engagement), qu'on aurait pu
//     croire décoratif ;
//   - « CHEF DE PROJET » n'est PAS un rôle du bureau : c'est une désignation sur
//     un projet, qui n'ouvre aucun droit particulier.
//
// ⚠ Dire aussi ce qu'on ne peut PAS faire, et pourquoi. La moitié des questions
// d'un nouveau membre porte sur une limite qu'il prend pour une panne.
// ============================================================================

export const ROLE_TOUS = 'tous'

/**
 * Le manuel. Un bloc par rôle, dans l'ordre de lecture d'un arrivant : ce que
 * tout le monde peut faire d'abord, les prérogatives ensuite.
 *
 * `peut` : ce que le rôle ouvre. `nePeutPas` : les limites, avec leur raison.
 */
export const MANUEL = [
  {
    cle: ROLE_TOUS,
    titre: 'Tout membre actif du conseil',
    resume:
      'Le socle. Ces actions n’exigent aucun rôle particulier : elles appartiennent à chaque membre du conseil, président compris.',
    peut: [
      {
        titre: 'Rédiger une décision',
        texte:
          'Créer une décision et la travailler en brouillon, seul, aussi longtemps qu’il le faut. Un brouillon n’est visible que de son auteur — le président lui-même ne le voit pas. Demander une décision au conseil n’est pas un pouvoir présidentiel : tout membre rédige et soumet les siennes.',
      },
      {
        titre: 'Planifier une soumission',
        texte:
          'Dater l’ouverture du vote pour plus tard. La décision reste un brouillon privé jusqu’au jour dit, puis s’ouvre seule. Utile pour qu’un vote ait lieu après une assemblée, avec le conseil qui en sortira.',
      },
      {
        titre: 'Soumettre au vote',
        texte:
          'C’est à ce moment, et à ce moment seulement, que la décision reçoit son numéro d’ordre et devient visible de tous. Le texte est alors figé : ni le titre ni la description ne se modifient plus, y compris pour l’auteur. Le montant, le rattachement et les pièces jointes restent modifiables — un devis arrive souvent après.',
      },
      {
        titre: 'Voter',
        texte:
          'Pour, contre ou abstention, sur les décisions ouvertes au vote. Chacun vote pour lui-même : personne ne vote à la place d’un autre. Ne pas voter, c’est être absent — ce n’est pas un choix enregistré.',
      },
      {
        titre: 'Poser une question, y répondre',
        texte:
          'Un fil de questions-réponses accompagne chaque décision et chaque projet.',
      },
      {
        titre: 'Tenir le journal d’un projet',
        texte:
          'Consigner ce qui a été fait, avec la date à laquelle cela s’est passé — modifiable, car une visite du 12 notée le 20 doit se ranger au 12. Chacun corrige et supprime ses propres lignes, personne ne réécrit le compte rendu d’un autre.',
      },
      {
        titre: 'Créer assemblées, résolutions et projets',
        texte:
          'Saisir une AG et ses résolutions, ouvrir un projet, y rattacher les enveloppes votées.',
      },
      {
        titre: 'Prévenir le conseil',
        texte:
          'Le bouton « Prévenir le CS » prépare un message pour le groupe WhatsApp. L’envoi reste manuel et volontaire : rien ne part tout seul.',
      },
    ],
    nePeutPas: [
      {
        titre: 'Supprimer le brouillon d’un autre',
        texte:
          'Un brouillon appartient à son auteur seul. Cela vaut aussi contre le président.',
      },
      {
        titre: 'Créer ou gérer depuis un téléphone',
        texte:
          'Sur mobile, l’application est en consultation et en vote. La saisie se fait sur ordinateur — un registre légal se relit avant d’être écrit.',
      },
    ],
  },

  {
    cle: 'president',
    titre: 'Président',
    resume:
      'Le président ne décide pas à la place du conseil : il constate. Sa prérogative propre est l’acte — inscrire au registre une délibération qui a eu lieu — et la signature.',
    peut: [
      {
        titre: 'Enregistrer une décision — l’acte',
        texte:
          'Figer le résultat du vote et l’inscrire au registre. L’application calcule le quorum et l’adoption ; le président constate. L’enregistrement conserve aussi la composition du conseil au jour du vote, pour que le PDF reste fidèle après un changement de mandat.',
        alerte:
          'IRRÉVERSIBLE. Une décision enregistrée ne se modifie plus, ne se vote plus, ne se supprime plus. C’est le verrou qu’impose l’article 15 aux délibérations inscrites au registre.',
      },
      {
        titre: 'Départager en cas de partage des voix',
        texte:
          'Quand les voix se partagent exactement, celle du président est prépondérante (art. 15). Encore faut-il qu’il ait voté : s’il s’est abstenu ou n’a pas voté, personne ne départage et la décision est rejetée.',
      },
      {
        titre: 'Signer le registre',
        texte:
          'Ouvrir les lots de signature. Signent tous les membres présents à la délibération — y compris ceux qui ont voté contre. Les absents n’ont pas de ligne de signature.',
      },
      {
        titre: 'Supprimer une décision soumise',
        texte:
          'Tant qu’elle n’est pas enregistrée et qu’elle ne porte aucun vote. Au-delà, on annule avec un motif : la trace reste au registre.',
      },
      {
        titre: 'Changer la visibilité, même sur une décision enregistrée',
        texte:
          'Publier n’est pas délibérer : le verrou de l’article 15 protège le texte, pas son audience. Chaque changement est tracé dans le journal d’audit.',
      },
      {
        titre: 'Gérer les membres du conseil',
        texte:
          'Ajouter, désactiver, attribuer les rôles du bureau. Le président de l’application suit le mandat, pas la personne : le nouveau président devient administrateur dès que son adresse porte le rôle.',
      },
      {
        titre: 'Consulter le registre des propriétaires',
        texte:
          'Avec le secrétaire, et eux seuls. Voir plus bas.',
      },
    ],
    nePeutPas: [
      {
        titre: 'Voir, modifier ou supprimer le brouillon d’un autre membre',
        texte:
          'Aucune exception n’est faite pour lui. C’est un choix explicite, et il ne doit pas être défait.',
      },
      {
        titre: 'Adopter une décision que le vote rejette',
        texte:
          'L’adoption se calcule, elle ne se décide pas. Le président enregistre un résultat, il ne le choisit pas.',
      },
      {
        titre: 'Modifier une décision enregistrée',
        texte:
          'Ni lui ni personne. Seuls le rattachement à un projet et la visibilité restent ouverts, et ils sont tracés.',
      },
    ],
  },

  {
    cle: 'tresorier',
    titre: 'Trésorier',
    resume:
      'Le trésorier n’a pas d’écran réservé — et pourtant son vote pèse plus que les autres sur un point précis. C’est la particularité la plus facile à manquer.',
    peut: [
      {
        titre: 'Débloquer l’adoption d’une dépense',
        texte:
          'Une décision qui engage de l’argent n’est adoptée que si le trésorier OU le président a voté pour. La majorité seule ne suffit pas. Si aucun des deux n’a voté pour, la décision est rejetée même largement majoritaire.',
        alerte:
          'Règle INTERNE au conseil, plus stricte que les statuts. Un trésorier qui ne vote pas bloque donc les dépenses, sauf si le président les soutient.',
      },
      {
        titre: 'Valider les comptes d’une assemblée',
        texte:
          'Les comptes d’une AG ne sont réputés validés que lorsque le trésorier et le président les ont tous deux approuvés.',
      },
      {
        titre: 'Suivre et exporter les budgets',
        texte:
          'Budgets consolidés par assemblée et par projet, et export CSV pour le syndic. Accessible à tous les membres — le trésorier en est simplement le premier lecteur.',
      },
    ],
    nePeutPas: [
      {
        titre: 'Engager une dépense seul',
        texte:
          'Son vote est nécessaire, jamais suffisant. Il faut aussi la majorité des membres présents.',
      },
      {
        titre: 'Accéder au registre des propriétaires',
        texte:
          'Réservé au président et au secrétaire. Le trésorier n’y voit rien, pas même le nombre de parcelles.',
      },
    ],
  },

  {
    cle: 'secretaire',
    titre: 'Secrétaire',
    resume:
      'Le secrétaire partage avec le président la tenue matérielle du registre et l’accès aux données des propriétaires.',
    peut: [
      {
        titre: 'Ouvrir et suivre les signatures',
        texte:
          'L’écran des signatures lui est ouvert comme au président (art. 14 et 15).',
      },
      {
        titre: 'Tenir le registre des propriétaires',
        texte:
          'Parcelles, superficies, propriétaires actuels, historique des mutations, coordonnées, destinataires des convocations. En lecture comme en écriture.',
        alerte:
          'DONNÉES PERSONNELLES DE TIERS. Seuls le nom, l’adresse dans le lotissement et la parcelle sont communicables. Toute autre divulgation engage la responsabilité personnelle de celui qui la commet. Une mention à accepter une fois précède le premier accès.',
      },
    ],
    nePeutPas: [
      {
        titre: 'Enregistrer une délibération',
        texte:
          'L’acte reste au président. Le secrétaire tient le registre, il ne le clôt pas.',
      },
    ],
  },

  {
    cle: 'chef_projet',
    titre: 'Chef de projet et adjoint',
    resume:
      'Ce n’est pas un rôle du bureau mais une désignation sur un projet : elle dit qui pilote, et n’ouvre aucun droit supplémentaire. Le chef de projet ne dépense pas — il prépare la décision qui permettra au conseil de dépenser.',
    // ⚠ Un chef de projet n'a pas besoin de connaître ses droits, il a besoin de
    // savoir DANS QUEL ORDRE faire les choses. D'où cette marche à suivre, qui
    // suit le vrai cheminement : de l'enveloppe votée à la facture payée.
    demarche: [
      {
        titre: 'Vérifier l’enveloppe avant toute chose',
        texte:
          'Ouvrez la fiche du projet : le budget alloué y figure. Il n’est jamais saisi — c’est la somme des résolutions d’assemblée adoptées qui pointent vers ce projet. S’il affiche zéro, aucune enveloppe n’a été rattachée : cela se corrige depuis la fiche de l’AG (« Rattacher à un projet »), pas depuis le projet. Sans enveloppe votée, rien ne pourra être engagé.',
      },
      {
        titre: 'Tenir le journal dès le premier jour',
        texte:
          'Chaque visite, appel, courrier, réunion sur place. Saisissez la date à laquelle la chose s’est passée, pas celle où vous l’écrivez : une visite du 12 notée le 20 doit se ranger au 12. C’est ce journal qui permettra, dans deux ans, de savoir pourquoi telle entreprise a été écartée et à quelle date le chantier a démarré.',
      },
      {
        titre: 'Consulter plusieurs fournisseurs',
        texte:
          'Demandez plusieurs devis. Consignez au journal qui a répondu, à quel prix, ce que le devis comprend et ce qu’il exclut. Les devis eux-mêmes se joignent en pièces jointes — sur le projet pendant la consultation, puis sur la décision qui retiendra l’un d’eux.',
      },
      {
        titre: 'Rédiger la décision qui engage la dépense',
        texte:
          'C’est le seul moyen d’engager de l’argent. Créez une décision, choisissez « Projet » comme cible, puis votre projet. L’écran affiche alors trois chiffres : alloué, déjà engagé, restant. Saisissez le montant du devis retenu, indiquez le taux de TVA et si le montant est HT ou TTC — l’application calcule le coût TTC et prévient en rouge s’il dépasse le disponible.',
        alerte:
          'La description doit expliquer le CHOIX, pas seulement le montant : quelles entreprises ont été consultées, pourquoi celle-ci. Le texte sera figé dès la soumission au vote et ne pourra plus être modifié — c’est lui qui restera au registre.',
      },
      {
        titre: 'Joindre le devis retenu',
        texte:
          'À la décision, avant de soumettre. Les pièces jointes restent modifiables jusqu’à l’enregistrement — un devis corrigé arrive souvent après le vote — mais le devis qui fonde la décision doit y être dès le départ.',
      },
      {
        titre: 'Soumettre au vote et prévenir le conseil',
        texte:
          'La soumission fige le texte, attribue le numéro et rend la décision visible de tous. Rien ne part automatiquement : utilisez « Prévenir le CS » pour avertir le groupe, sinon personne ne saura qu’un vote est ouvert.',
        alerte:
          'Une décision qui engage de l’argent n’est adoptée que si le trésorier OU le président a voté pour. La majorité seule ne suffit pas : si aucun des deux ne s’est prononcé favorablement, la dépense est rejetée.',
      },
      {
        titre: 'Attendre l’enregistrement par le président',
        texte:
          'Tant que la décision n’est pas enregistrée, rien n’est engagé — le montant n’apparaît dans aucun budget et le fournisseur ne doit pas être commandé. L’enregistrement est l’acte qui inscrit la délibération au registre ; c’est à ce moment que la dépense devient réelle.',
      },
      {
        titre: 'Suivre l’exécution au journal',
        texte:
          'Commande passée, acompte versé, démarrage du chantier, réception des travaux, réserves éventuelles. Les factures se joignent au projet. C’est cette trace qui justifiera les paiements auprès du syndic et de l’assemblée.',
      },
      {
        titre: 'Clore, suspendre ou reprendre — encore une décision',
        texte:
          'Dans le formulaire de décision, le champ « Effet sur le projet » permet de suspendre, reprendre ou terminer. L’effet ne se produit qu’à l’enregistrement d’une décision adoptée. Le statut du projet est calculé à partir de ces délibérations, jamais saisi — c’est pourquoi aucun bouton ne le change directement.',
      },
    ],
    peut: [
      {
        titre: 'Piloter le projet et tenir son journal',
        texte:
          'Le chef et l’adjoint ont exactement les mêmes possibilités : l’adjoint existe pour que le projet ne s’arrête pas quand le chef est indisponible.',
      },
      {
        titre: 'Être identifié comme interlocuteur',
        texte:
          'Le nom apparaît dans la liste des projets et sur la fiche : chacun sait à qui poser sa question.',
      },
      {
        titre: 'Joindre les pièces du dossier',
        texte:
          'Devis, plans, factures, photos. Elles restent attachées au projet et survivent aux changements de chef.',
      },
    ],
    nePeutPas: [
      {
        titre: 'Engager une dépense seul',
        texte:
          'Aucun engagement n’existe avant qu’une décision ne soit votée et enregistrée. Commander sur la seule foi d’un devis, c’est engager l’association sans mandat.',
      },
      {
        titre: 'Suspendre, reprendre ou terminer par un bouton',
        texte:
          'Il n’en existe pas, volontairement. Ces trois transitions sont des délibérations du conseil : ni le chef de projet, ni l’adjoint, ni le président ne les décident seuls.',
      },
      {
        titre: 'Fixer ou corriger le budget du projet',
        texte:
          'Il n’est pas saisi : il découle des enveloppes votées en assemblée. L’assemblée vote, le conseil affecte, personne ne réécrit le montant.',
      },
      {
        titre: 'Corriger le journal d’un autre',
        texte:
          'Chacun corrige ses propres lignes. Piloter un projet n’est pas réécrire le compte rendu de ses collègues.',
      },
    ],
  },
]

/** Le bloc correspondant au rôle d'un membre, pour l'ouvrir en premier. */
export function blocDuRole(role) {
  return MANUEL.find((b) => b.cle === role) || null
}

// ============================================================================
// CE QUE PERSONNE NE PEUT FAIRE
//
// Les limites qui ne dépendent d'aucun rôle. Elles sont ici parce qu'un nouveau
// membre les prend systématiquement pour des pannes, et parce que plusieurs sont
// des choix qu'il ne faut pas défaire par mégarde.
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
      'La représentation — « ou représentés », dans les statuts — n’est pas gérée par l’application. Un membre sans vote est absent, jamais représenté. C’est l’écart connu entre les statuts et l’outil.',
  },
  {
    titre: 'L’abstention fait obstacle',
    texte:
      'L’adoption exige la majorité des membres PRÉSENTS, et un abstentionniste est présent. S’abstenir n’est donc pas neutre : cela rend l’adoption plus difficile.',
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
]
