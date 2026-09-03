# État courant / point de reprise — Registre CS Rives

> Dernière session : **2026-08-26** — **journal de bord des projets** (migration 029, appliquée).
> Avant : décisions en **brouillon** avec **soumission planifiée**
> (migrations 026 et 027, **appliquées en prod**), **code déployé** ; puis **adjoint de projet +
> fil d'échanges** (migration 028, appliquée) et la **spéc d'onboarding des colotis**, gelée. Puis : statuts en révision,
> l'AG du 15/09 les adapte au fonctionnement de l'app — voir le backlog.
> Précédemment : PJ sur les résolutions d'AG (025) ; chantier AG + TVA (022-024).
> ⚠ Toujours une **maquette de validation**, pas encore un registre de production (voir « En bref »).
>
> Fichier à lire en premier pour reprendre (après le `CLAUDE.md` du dépôt et `PASSATION.md`).
> Pour le staging/UAT, voir **`docs/STAGING_UAT.md`**.

---

## En bref

L'application est une **maquette de validation** (**https://cs-rives.vercel.app**),
**fonctionnellement complète pour le périmètre actuel** : registre des décisions (création, vote,
enregistrement, verrou légal), AG + résolutions, projets, budgets + CSV Foncia, PDF, signature par
groupes homogènes, rôles du bureau. La base live contient les **5 vrais membres** du CS et l'AG
**`AGO-2026-001`** (8 résolutions).

⚠ **Ce n'est PAS encore un registre de production**, et il ne faut pas le présenter comme tel :
- **Aucune sauvegarde** des données (Supabase gratuit) — une perte serait définitive.
- **Pas de signature électronique valide** — le module est un *mock* (`yousignProvider` throw) ;
  l'exigence de signature de l'art. 15 n'est donc pas remplie par voie électronique.

La fiabilisation (Supabase Pro + sauvegardes, signature réelle, transfert à l'ASL) fait l'objet
du budget demandé à l'AG et du backlog ci-dessous.

## Session 2026-09-03 (suite 5) — parcours transversaux + doc technique

- **✅ Menu élargi** de 16 à 18 rem : « Registre des propriétaires » et « Messages aux
  propriétaires » + son badge ne tenaient pas sur une ligne. ⚠ Les **flèches flottantes** de la
  fiche parcelle sont calées sur cette largeur (`md:left-[18.75rem]`) — élargir l'un sans décaler
  l'autre les ferait chevaucher.
- **✅ SIX parcours transversaux ajoutés** aux côtés de « conduire un projet », qui les rejoint
  naturellement : affecter un budget voté à un projet, mener une décision du brouillon à la
  signature, **annuler ou supprimer une décision**, tenir une AG de la convocation au PV, accueillir
  un nouveau membre après une élection, enregistrer une mutation.
  ⚠ **Leur place est là et pas sous un écran** : affecter un budget va de l'AG au projet, mener une
  décision va du brouillon à la signature. Les ranger sous un menu aurait obligé le lecteur à
  deviner lequel.
- **✅ « Comment faire » devient une ENTRÉE DE MENU à part entière** (Pascal, le même jour), avant
  le manuel. ⚠ Ce sont **deux questions différentes** : le manuel répond à « je suis sur cet écran,
  que puis-je y faire ? », les parcours à « je dois accomplir telle chose, par où je commence ? ».
  Les enfouir sous le manuel les rendait introuvables — et on cherche plus souvent à accomplir une
  tâche qu'à inventorier un écran, d'où leur place **avant** dans le menu.
- **Les deux pages se renvoient l'une à l'autre** : sans ce lien, le lecteur qui se trompe d'écran
  ne trouve rien. Et le manuel **ne rend plus** les parcours — une doublure finit toujours par
  diverger.
- **Contenus qui répondent à des pièges réels** :
  - *Affecter un budget* : le rattachement se pilote **depuis l'AG, jamais depuis le projet** —
    c'est le contresens le plus courant, et le formulaire du projet n'a volontairement aucun champ
    de budget.
  - *Annuler ou supprimer* : quatre situations selon l'avancement, et une décision **enregistrée ne
    se retire jamais** — le conseil prend une nouvelle décision qui revient sur la précédente.
  - *Nouveau membre* : l'adresse e-mail doit être **identique au caractère près** entre la fiche et
    le compte Supabase. C'est la panne de chaque renouvellement.
- **✅ `docs/TECHNIQUE.md`** — point d'entrée d'un développeur qui reprend le projet. Il ne redit
  pas ce qui existe : il dit **où** chaque chose est écrite et **dans quel ordre** la lire, puis
  expose les cinq idées d'architecture (dérivé plutôt que stocké, deux backends à parité, la
  sécurité en base et non dans l'écran, l'identité par l'e-mail, le verrou de l'acte), les pièges
  déjà payés, et **comment un membre du CS peut faire corriger un défaut sans être développeur**.
  Lié depuis le README.

## Session 2026-09-03 (suite 4) — MENU RÉORGANISÉ en trois sections

- **✅ Le menu passe d'une liste plate de dix entrées à trois sections** : **Gestion** (ce qu'on
  fait), **Données** (ce qu'on tient), **Application** (l'outil lui-même). On y choisit au lieu
  d'y chercher.
- **Le tableau de bord quitte la liste pour une ICÔNE** en tête : c'est un point de départ, pas une
  rubrique — et cela retire une ligne. Titre de l'app : **ASL Rives**.
- **Intitulés précisés** : « Signatures légales », « Registre des propriétaires », « Mémoire de
  l'ASL », « Manuel d'utilisation ».
- **« Messages aux propriétaires » figure GRISÉ**, non cliquable, avec la mention « à venir ».
  ⚠ Choix assumé : montrer où la fonction arrivera plutôt que la taire, pour qu'on ne la cherche
  pas ailleurs. Réservée au bureau, comme le registre dont elle tirera les adresses. Elle attend
  l'adresse de l'ASL et un service d'envoi.
- **Une section dont tout est masqué disparaît entièrement** : un intertitre sans rien dessous
  ressemble à une panne.
- ⚠ **Le manuel a été réaligné** : mêmes intitulés, même ordre. Sans quoi le lecteur chercherait
  « Signatures » dans une barre qui affiche « Signatures légales ». La vérification compare
  désormais `aideLogic.js` à `Layout.jsx` — c'est le point qui se dégradera en premier.

## Session 2026-09-03 (suite 3) — MANUEL REFONDU : par écran, pas par rôle

- ⚠ **Changement d'approche demandé par Pascal**, et il est juste : « je ne vois que la doc
  pertinente à mon rôle, je ne vois que les menus et boutons accessibles. La doc liste l'entrée
  de menu et les actions possibles ; si je veux voir comment faire, j'appuie sur l'action qui se
  déploie en pas-à-pas. »
- **L'organisation bascule du RÔLE vers le MENU.** On n'ouvre pas un manuel en se demandant « que
  puis-je en tant que trésorier ? », mais « je suis sur cet écran, comment je fais telle chose ? ».
  Le rôle ne sert plus qu'à **filtrer**.
- **Chaque action se déplie en pas-à-pas**, repliée par défaut, une seule ouverte à la fois : une
  action qu'on sait faire ne doit pas encombrer.
- ⚠ **`visiblePar` reproduit le filtrage de `Layout.jsx`** — le manuel ne décrit jamais un écran
  que le lecteur ne voit pas. **Modifier l'un oblige à modifier l'autre**, et la vérification le
  contrôle (un membre simple ne doit voir ni Signatures ni Propriétaires).
- ⚠ **La liste grisée des actions interdites est SUPPRIMÉE** (Pascal, le même jour) : elle
  encombrait sans rien expliquer. Chaque écran porte désormais une **note rédigée**, affichée
  seulement à qui y est bridé — « cet écran est en lecture seule pour vous ; le président et le
  secrétaire tiennent les assemblées parce que… ».
- ⚠ **ERREUR DE FOND CORRIGÉE** : le manuel annonçait que **tout membre** pouvait créer une AG et
  ses résolutions. **Faux** — la RLS les réserve au président et au secrétaire
  (`ag_secretaire_insert/update` + `write_admin`), et l'écran cachait d'ailleurs déjà le bouton.
  C'est exactement l'erreur que l'en-tête du fichier interdit : promettre un bouton qui n'existe
  pas. Cinq actions corrigées, plus la modification d'un projet (chef, adjoint ou président).
- ⚠ **Défaut attrapé par la vérification** : un écran dont aucune action n'était ouverte
  **disparaissait du manuel** — contraire au principe « on ne cache pas un écran qu'on peut lire ».
  Un écran visible reste désormais au manuel quoi qu'il arrive, et la **lecture d'une assemblée**
  est documentée comme une action à part entière (où trouver le PV, les résolutions, les résultats).
- **Audit de l'interface, fait à cette occasion** : l'app cachait **déjà** correctement ses boutons
  d'écriture — `canManage` dans `AGList`, `AGDetail` et `Membres`, `canEdit` dans `ProjetDetail`
  (chef, adjoint ou président). Rien à corriger de ce côté : c'était le manuel qui mentait.
- **PARCOURS transversaux** : « conduire un projet, de l'enveloppe à la facture » ne relève
  d'aucun menu — il va de l'AG au registre en passant par les projets. D'où une section à part,
  ouverte à tous puisque n'importe quel membre peut être désigné chef de projet.
- **Neuf écrans, une cinquantaine d'actions**, toutes avec leur pas-à-pas — vérifié
  automatiquement : aucune action ne peut être publiée sans marche à suivre.

## Session 2026-09-03 (suite 2) — LA MÉMOIRE DU LOTISSEMENT (045 ✅ appliquée)

- **✅ Livrée** : `sujets` (la synthèse) + `sujet_entrees` (la chronologie), écrans liste et fiche,
  entrée « Mémoire » au menu, méthodes repo **aux deux backends à parité**.
- **Le besoin** : le portail, la plage, les canalisations, la zone C, le recouvrement, le cahier
  des charges — chacun a une histoire de plusieurs années, éparpillée entre des dossiers Finder,
  des courriels et la tête du président sortant. **Un nouveau conseil hérite des décisions mais pas
  du POURQUOI**, et refait les débats déjà tranchés.
- ⚠ **DEUX tables pour deux questions**, et c'est la décision structurante : « où en est-on ? »
  appelle une **synthèse réécrite**, « comment y est-on arrivé ? » une **chronologie qui s'ajoute**.
  Un seul champ de texte aurait perdu l'attribution et la date des faits, et obligé à rouvrir toute
  la page pour ajouter une ligne.
- **`titre` unique** — deux « Portail » scinderaient la connaissance en deux moitiés incomplètes.
- **Lue par tous les membres**, contrairement au registre des propriétaires : c'est la mémoire
  commune du conseil, la cacher recréerait le problème qu'elle résout.
- **Synthèse collective, entrées personnelles** : tout membre actif améliore la synthèse (à cinq
  personnes, exiger une validation garantirait surtout que rien ne soit jamais écrit) ; chacun
  corrige ses propres entrées, comme au journal de projet. ⚠ **Seul le président supprime un
  sujet** — effacer une mémoire nourrie par d'autres n'est pas une correction.
- **L'écran pousse à écrire le POURQUOI** : l'encart « Comment nourrir ce sujet » demande
  explicitement de consigner **les impasses** — savoir qu'une piste a été écartée, et pourquoi,
  évite de la reprendre dans trois ans.
- ⚠ **Limite assumée, v1** : **aucun lien formel vers les décisions et les projets**. Ce serait la
  suite naturelle (« tout ce qui concerne le portail »), mais une table de liaison est une
  complexité qu'on n'ajoute pas avant d'avoir vu comment les sujets sont réellement utilisés. En
  attendant, on cite les numéros de décision dans le texte.
- **Reste de la demande** : le **point d'entrée technique** pour un développeur et le **« comment
  faire évoluer l'app »** pour un membre du CS — surtout de l'assemblage de ce qui existe déjà
  dans `docs/`.

## Session 2026-09-03 (suite) — MANUEL PAR RÔLE dans l'app

Demande de Pascal : une base de connaissance et trois documentations — technique, « comment
faire évoluer l'app », et manuel par rôle. ⚠ **Deux natures différentes, deux endroits** : la
documentation change quand le code change, donc elle est **versionnée avec lui** ; la mémoire
du lotissement grandit avec la vie de l'association, donc elle demande une **table**. Ne pas
les mélanger.

- **✅ Manuel par rôle livré en premier**, pour une raison de calendrier : l'AG du 15 peut
  élire un nouveau conseil, et ces membres arriveront dans une app qu'ils ne connaissent pas.
- **Rôles couverts** : socle « tout membre actif », président, trésorier, secrétaire, chef de
  projet. Le bloc du lecteur s'ouvre d'emblée, les autres restent consultables — savoir ce que
  le président ne peut PAS faire évite la moitié des malentendus d'un conseil.
- ⚠ **DEUX PIÈGES VÉRIFIÉS DANS LE CODE avant d'écrire** :
  - le **trésorier a un vrai pouvoir**, qu'on aurait pu croire décoratif : sans son vote ou
    celui du président, une décision qui engage de l'argent n'est pas adoptée (`engagementApprouve`) ;
  - **« chef de projet » n'est pas un rôle du bureau** — `membres_cs.role` ne connaît que
    président / trésorier / secrétaire / membre. C'est une désignation sur un projet, qui
    n'ouvre aucun droit. Un manuel qui laisserait croire l'inverse serait pire que rien.
- **Chaque bloc dit aussi ce qui est IMPOSSIBLE, et pourquoi.** Trois alertes portent ce qui
  coûte cher à ignorer : l'irréversibilité de l'acte, le pouvoir réel du trésorier, la
  responsabilité personnelle du secrétaire sur les données des propriétaires.
- **✅ Le bloc « chef de projet » réécrit en MARCHE À SUIVRE** (correction de Pascal, le même
  jour). Ma première version listait ses **droits** ; ce dont il a besoin, c'est de savoir
  **dans quel ordre faire les choses**. Neuf étapes, de l'enveloppe votée à la facture payée :
  vérifier le budget alloué, tenir le journal dès le premier jour, consulter plusieurs
  fournisseurs, rédiger la décision qui engage (avec TVA, HT/TTC et l'alerte de dépassement),
  joindre le devis, soumettre et prévenir, **attendre l'enregistrement avant de commander**,
  suivre l'exécution, clore par une décision.
  ⚠ L'ordre EST le fond du sujet : commander sur la foi d'un devis avant l'enregistrement,
  c'est engager l'association sans mandat. D'où une liste numérotée, placée **avant** les
  droits.
- **Reste à faire** : (1) la **mémoire du lotissement** — base de connaissance par sujet
  (portail, plage, canalisations, zone C, recouvrement…), qui est de la **donnée** et demande
  une table, des droits et des pièces jointes ; (2) le **point d'entrée technique** pour un
  développeur ; (3) le **« comment faire évoluer l'app »** pour un membre du CS.

## Session 2026-09-03 — outillage d'envoi versionné, et « reprendre le projet »

- **✅ `scripts/creer_groupes_colotis.py` entre dans le dépôt**, avec
  `scripts/REQUETE_export_destinataires.sql`. Il vivait dans `4_ASL/7-contacts/`, hors
  versioning : c'était le seul vrai trou de la passation — un outil de travail qui aurait
  disparu au transfert. ⚠ Le script est un **mécanisme**, il ne contient aucune donnée
  personnelle ; le CSV qu'il consomme en contient cinquante et **ne doit jamais entrer ici**.
- **✅ `docs/TRANSFERT_ASL.md` gagne une section « Reprendre le projet »**, en réponse à la
  question de Pascal : que transfère-t-on du projet lui-même ?
  **Rien de plus que le dépôt — et c'est un choix.** La valeur tient à `CLAUDE.md` et à ce
  journal, tous deux versionnés depuis le début, écrits en français lisible parce qu'un
  successeur les reprendra peut-être sans assistant.
- ⚠ **Ce qui ne se transfère pas, consigné** : les ~41 Mo d'historique de conversation dans
  `~/.claude` (liés à la machine, et **contenant les données RGPD des colotis** — à effacer
  avec le poste), l'abonnement, et les dossiers de travail `propriétaires/` et `7-contacts/`.
  Ces derniers passent par le classeur de l'ASL, pas par GitHub. Ils **se reconstruisent**
  depuis le registre : ce ne sont pas des originaux, le registre l'est.

## Session 2026-09-01 (suite) — DESTINATAIRES MULTIPLES (044 ✅ appliquée)

- ⚠ **La 043 avait un contresens : un choix UNIQUE.** Correction de Pascal — « s'il y a un e-mail
  pour le mandataire et pour le propriétaire, il faut envoyer aux deux ». Une convocation ne
  s'adresse pas à une personne : une indivision a **deux** indivisaires à prévenir, une donation
  démembrée l'**usufruitier ET le nu-propriétaire**, une SCI dont le dirigeant est au loin se
  convoque chez lui **et** chez son mandataire sur place. Ne retenir qu'une adresse, c'était
  accepter de ne pas convoquer quelqu'un.
- **✅ Quatre cases à cocher** : propriétaire, second propriétaire, dirigeants, mandataire. La source
  « dirigeants » rend **les deux** dirigeants — tous deux engagent la société.
- **`contact_officiel` devient `contacts_officiels`, en `text[]`.** ⚠ Renommée au pluriel : un nom
  singulier pour un ensemble est la dérive corrigée par la 042 entre « gérant » et « dirigeant ».
  ⚠ Le changement de type **préserve** les choix déjà faits (`array[contact_officiel]`).
- **Tableau plutôt que quatre booléens** : l'opération naturelle est « donne-moi tous les
  destinataires de ce lot », c'est une liste ; et une cinquième destination serait une valeur, pas
  une colonne de plus à réunir à la main chez chaque appelant.
- ⚠ **Au moins une case** : un ensemble vide voudrait dire « ne convoquer personne », ce qu'aucun
  registre ne doit pouvoir exprimer par distraction. Décocher la dernière retombe sur le propriétaire.
- La migration **coche d'office le second propriétaire** là où il existe : s'il est au registre,
  c'est qu'il est copropriétaire, et un copropriétaire se convoque. Sans cela **dix-sept personnes**
  seraient restées hors des convocations sans que rien ne le signale.
- L'écran montre **le résultat tel qu'il partira**, avec la provenance de chaque adresse — et dit
  « injoignable » quand aucune source cochée ne porte de coordonnées.
- ⚠ **Correction dans la foulée** : la migration cochait le second propriétaire sur les 17 lignes
  qui en portent un, **sans regarder s'il avait une adresse**. Or la plupart n'ont qu'un nom
  (« Mme Junod », « Mme Gladkov »…). Une case cochée qui ne produit aucun destinataire **laisse
  croire que la personne est convoquée** — c'est le genre de faux qu'un registre de convocation ne
  peut pas se permettre. Les cases sans effet ont été décochées, et chaque case porte désormais la
  mention **« sans coordonnées »** quand sa source n'apporte rien.
- **La case reste cochable malgré tout** : on peut vouloir la cocher avant de saisir l'adresse. Ce
  qui compte est que son absence d'effet se VOIE, pas qu'elle soit interdite.

## Session 2026-09-01 — CONTACT OFFICIEL de convocation (043 ✅ appliquée)

- **✅ Trois boutons radio sur la fiche** : l'adresse de convocation vient du **propriétaire**
  (saisie à la main), d'un **dirigeant** ou du **mandataire** (repris, non modifiables ici).
- ⚠ **La colonne stocke la SOURCE, jamais l'adresse.** Recopier aurait produit les deux faux
  habituels : corriger l'e-mail du mandataire n'aurait pas mis la convocation à jour, et basculer le
  bouton aurait écrasé l'adresse propre du propriétaire. Dérivé à la lecture — même principe que le
  tantième, le budget d'un projet ou le statut d'un projet.
- ⚠ **Aucune retombée quand la source désignée est vide** : l'écran affiche « injoignable » plutôt
  que l'adresse du propriétaire. Retomber dessus ferait croire à un envoi possible.
- **`email` et `telephone` restent la propriété du propriétaire** : conservés et réaffichés si l'on
  revient sur « Le propriétaire ». La fiche le dit explicitement.
- **La liste montre le contact OFFICIEL**, avec sa provenance quand ce n'est pas le propriétaire —
  sans quoi on croirait écrire au coloti alors qu'on écrit à son relais. Le tri par e-mail suit.
- La migration **désigne d'office le mandataire** sur les parcelles sans adresse de propriétaire
  (0B 198, 229, 240) : leur convocation passait déjà de fait par l'intermédiaire.
- Nouveau fichier `src/lib/proprietaireLogic.js`, dans la lignée de `agLogic` / `projetLogic`.
- **✅ Navigation « précédente » / « suivante »** sur la fiche, dans l'ordre des parcelles du
  registre. L'ordre est **calculé côté écran** : `listLots` ne le garantit pas identique selon le
  backend, et naviguer dans un ordre différent de celui du registre serait déroutant.
- **✅ Navigation au CLAVIER** (flèches gauche et droite) et **paire de flèches flottante** collée au
  bord gauche du contenu, sous la main quel que soit le défilement. ⚠ Deux gardes sur le clavier :
  rien n'est détourné quand le curseur est **dans un champ** (les flèches y déplacent le curseur, et
  ce formulaire en est plein) ni quand une **touche de modification** est enfoncée, pour laisser
  intacts les raccourcis du navigateur.
- **✅ Le défilement est conservé d'une fiche à l'autre.** ⚠ Le coupable n'était pas la position des
  boutons : c'est le `Spinner` qui **vidait la page** pendant le chargement de la suivante — hauteur
  à zéro, défilement ramené en haut par le navigateur, position irrécupérable. La fiche précédente
  reste donc affichée le temps que la suivante arrive, et la position est rétablie en
  `useLayoutEffect` (avant peinture, sinon on voit la page sauter puis redescendre).
- ⚠ **Défaut préexistant corrigé au passage** : `if (error)` remplaçait TOUTE la fiche par une carte
  d'erreur, y compris quand c'était un **enregistrement** qui échouait — la saisie disparaissait de
  l'écran au moment précis où l'on demandait de la corriger, et la garde de navigation ne tenait
  donc pas sa promesse. L'erreur pleine page est désormais réservée à un échec de **chargement**.
- **✅ La navigation suit LE TRI CHOISI dans la liste** (demande de Pascal). Le tri est donc sorti
  de la page pour `proprietaireLogic.js` : `TRIS`, `lireTri`, `ecrireTri`, `trierLots`. ⚠ Dupliquer
  les comparateurs aurait produit un décalage muet — trier par superficie dans la liste puis cliquer
  « suivante » aurait mené à la parcelle suivante par NUMÉRO. La page ne garde que la mise en page
  des en-têtes.
- ⚠ **Garde sur les modifications non enregistrées** : quitter une fiche modifiée propose de
  l'enregistrer, et **refuser laisse sur place** plutôt que de perdre la saisie. Si l'enregistrement
  **échoue**, on ne navigue pas — `enregistrer()` renvoie désormais un booléen exprès. Sans cela la
  garde n'aurait protégé que le cas facile.
- **Premiers usages réels du réglage par Pascal** : 0B 197 (mandataire Condrea Liliana, l'adresse
  `leman.decor` étant celle d'un tiers et non des dirigeants) et **0B 220**, où la SCI Aljasser a
  pourtant une adresse mais où les convocations passent par Mme Haumont — le cas que le bouton
  existe pour exprimer.

## Session 2026-08-28 (suite 6) — ⏳ EN ATTENTE DE FONCIA

- **📤 Demande de correction ENVOYÉE au syndic le 2026-08-28** (document Word remanié par Pascal
  lui-même avant envoi ; le générateur qui l'avait produit a été supprimé pour ne plus risquer de
  l'écraser).
- **⏳ UNE SEULE CHOSE EN ATTENTE : la date de l'acte de vente à la SCI GABISAM** (SIREN
  104 869 086, immatriculée le 2026-05-11), pour passer la mutation de **0B 208** — Pflieger sortant,
  Gabisam entrant. ⚠ **Ne pas relancer la demande**, elle est partie ; et **ne pas passer la
  mutation sans la date** : on perdrait les bornes de la période de l'ancienne propriétaire.
- **Sans objet, tranché par Pascal** : la question du « 51ᵉ lot » et du compte Foncia 503 non
  attribué. **Les charges étant au prorata des superficies**, et la somme des 50 superficies faisant
  exactement le total cadastral (104 646 m²), la parcelle 263 est intégralement facturée à travers
  ses deux lignes. Le 51ᵉ lot n'est qu'un artefact de comptage. ⚠ Corollaire : `nombre_lots` ne sert
  qu'à afficher un total juste — il n'entre **ni dans les voix ni dans les charges**.
- **Coïncidence relevée, non élucidée** : la SCI GABISAM et la SCI ALJASSER FAMILY COMPANY sont
  domiciliées à la **même adresse**, 25 rue du Bourg à Messery. Domiciliation commerciale partagée,
  ou lien entre les deux dossiers.

## Session 2026-08-28 (suite 5) — casse des adresses uniformisée

- **✅ 49 adresses de communication réécrites** : elles arrivaient toutes en CAPITALES de l'état
  Foncia. Minuscules pour les types de voie (« allée de Rives », « route de Messery »), majuscules
  aux noms propres, **accents rétablis**, et **apostrophes typographiques** (`’`) plutôt qu'ASCII —
  ce qui suit la convention du projet et supprime au passage tout besoin d'échappement SQL.
- ⚠ **Réécrites À LA MAIN, pas par `initcap()`.** La fonction Postgres aurait produit « Allee De
  Rives » : sans accent, avec un « De » majuscule, et « SCI » rendu « Sci ». Dans un registre légal,
  cela remplace une faute par une autre.
- **Erreurs de la source redressées au passage** : commune de 0B 244 (Nernier et non Messery),
  numéro de 0B 246 (46 et non 44), « allée de Rives 11 » remis dans l'ordre (0B 223), « allée
  Précettes » complété en « allée des Précettes » (0B 234).
- **Arbitrages, à connaître avant de les défaire** :
  - **0B 214 et 0B 247+263** n'avaient aucun numéro de rue ; celui de la parcelle a été repris
    (1 et 42 allée de Rives).
  - **0B 216** : le « S/C Mme Delucinge » a été remplacé par le **siège officiel** de la SCI
    Marguerite (7 avenue Alsace-Lorraine) — le champ porte une adresse, pas un intermédiaire ; la
    gérante, elle, est nommée dans le bloc dirigeants.
  - **0B 245 reste incomplète** : la source ne donne que « AMIRAL », sans type de voie ni numéro.
    **Ne pas inventer** — le champ dira la vérité tant qu'on n'aura pas mieux.
- ⚠ **`observations` est exclu de toute normalisation** : ce champ contient le **libellé exact du
  syndic**, cité tel quel. Le corriger détruirait la citation qui sert précisément à comparer les
  deux registres.

## Session 2026-08-28 (suite 4) — les sociétés vérifiées au REGISTRE OFFICIEL

Source : `recherche-entreprises.api.gouv.fr` (INSEE / RNE). Elle **prime** sur nos listes de vote
comme sur l'état du syndic. Aucune migration, uniquement des `update`.

- **✅ Les 13 sociétés du registre sont conformes** au nom officiel, avec leurs dirigeants réels et
  leurs fonctions.
- ⚠ **SIX des douze SCI ne portent pas « SCI » dans leur nom** — Logudoro, Le Clapotis, Entre Lac et
  Montagnes, Kitka, Maison du Lac, Precettes. Nous l'avions ajouté à l'import, sur la seule foi du
  classeur de l'ASL. « Entre Lac et Montagne**s** » prend en outre un S que personne n'écrivait.
- ⚠ **TROIS dirigeants étaient faux** : le gérant de Logudoro est **Laurent** Pais (Marc n'est
  qu'associé), celui de Kitka est **Isabelle Kittler** (Nicolas Kah n'est qu'associé), et
  `bougarye@mac.com` est **Mona Baker Bougary, associée de Precettes** — nous l'avions rangée en
  mandataire.
- ⚠ **DEUX « erreurs » du syndic n'en étaient pas — vérifier avant d'accuser** :
  - **GABISAM** est une SCI **réellement créée le 2026-05-11** (gérants Sarah et Aurélien Clozel) :
    la parcelle 0B 208 a changé de mains cette année, Foncia est à jour et c'est **notre** registre
    qui porte encore Mme Pflieger.
  - **JEANLU** est le **nom d'une société** (SIREN 504838772) dont Chappuis Olivier est dirigeant.
    Nous confondions le dirigeant et le propriétaire.
  - Il ne reste donc **aucune mutation** à reprocher au syndic, et **une seule date à lui demander**
    (celle de la vente à GABISAM).
- **0B 208 laissé en l'état, délibérément** : une mutation sans date exacte serait pire que le
  retard actuel — on perdrait les bornes de la période de l'ancienne propriétaire. À passer dès que
  Foncia donne la date de l'acte.
- **Deux arbitrages de Pascal confirmés** par la source officielle : Claude **Terrier** est bien
  gérant du Clapotis, et Catherine **Delucinge** bien gérante de la SCI Marguerite — le « S/C » du
  syndic désignait donc bien des dirigeants.
- ⚠ **« Tino » Pais ne figure nulle part** au registre officiel, qui donne Laurent et Marc. Posé
  Laurent en gérant, à corriger si Tino est un prénom d'usage.
- **Conservé malgré un doute** : `mehdi@msconsulting-france.com` reste mandataire de Maison du Lac
  bien qu'il s'agisse probablement du gérant de Precettes. Si c'est réellement l'intermédiaire des
  deux familles, le supprimer ferait perdre un contact utile.
- 🔑 **PISTE MAJEURE — la numérotation d'origine des lots existe.** Le siège de LE CLAPOTIS est
  déclaré « **LOT 5 DU LOTISSEMENT DE RIVES** » ; cette société occupe `0B 203`, donc **lot 5 =
  0B 203**. C'est la première correspondance retrouvée entre la numérotation de 1955 et le cadastre.
  À demander à Me Garnier pour l'ensemble des titres.
- **Document produit**, hors dépôt : `propriétaires/SOCIETES_REGISTRE_OFFICIEL.md` — les 12 sociétés
  avec SIREN, siège et dirigeants.

## Session 2026-08-28 (suite 3) — rapprochement avec l'état Foncia

- **✅ 13 seconds propriétaires ajoutés** : le registre en compte désormais **17 à deux noms, dont 4
  en indivision**. Aucune migration, uniquement des `update`.
- ⚠ **LA LEÇON, à ne pas réapprendre : « M. ou Mme X » chez Foncia signifie que LES DEUX sont
  propriétaires.** Je l'avais lu comme une formule de politesse et j'allais demander au syndic de
  « corriger » une quinzaine de comptes — dont trois que je présentais comme des **mutations**
  (Pargoux, Gridello/Van Den Berg, Huergo), alors que la seconde personne est la conjointe
  copropriétaire. Corrigé par Pascal avant envoi.
- **Il n'y a que DEUX vraies mutations** à faire dater par Foncia : **GABISAM → Pflieger** (0B 208)
  et **JEANLU → Chappuis** (0B 692).
- ⚠ **`est_indivision` n'est PAS coché** sur les 13 nouveaux : un couple marié n'est pas en
  indivision. La case sert précisément à ne pas confondre les deux.
- **Deux cas laissés ouverts** : 0B 247+263, où l'état dit « MM. et Mmes … GRIDELLO » (donc plus de
  deux personnes), et 0B 199 (Pargoux), où l'état ne porte pas « ou Mme » — rien n'établit qu'ils
  soient deux. À trancher sur les titres de propriété que Me Garnier réunit.
- **Documents produits pour le syndic**, hors dépôt (données personnelles) dans
  `_1_lotissement/propriétaires/` : `ECARTS_REGISTRE_FONCIA.md` (le détail complet) et
  `Corrections_registre_Foncia.docx` (A4 paysage, deux tableaux — corrections de saisie d'un côté,
  mutations à dater de l'autre). ⚠ **Ne jamais publier ces documents en ligne** : ils nomment
  cinquante propriétaires, c'est exactement la diffusion que la mention RGPD interdit.
- **Reste à corriger chez nous** (l'état du syndic et le carnet d'adresses concordent contre nos
  listes de vote) : VOLLBRECHT avec deux L (0B 206), TKATCHOUK (0B 214), ALLEN qui est le nom et
  Peregrine le prénom (0B 239), Florent et non Florian (0B 246).

## Session 2026-08-28 (suite 2) — « dirigeant » remplace « gérant » (042 ✅ appliquée)

- **✅ Renommage `gerant_*` → `dirigeant_*`.** Correction de Pascal : « ce n'est pas gérant le bon
  terme, c'est dirigeant de la SCI avec des fonctions ». Elle est juste et n'est pas cosmétique :
  **gérant est une FONCTION, pas une catégorie**. Une SCI a des dirigeants, dont l'un peut être
  gérant, un autre président, un autre associé — et le champ `dirigeant_fonction` est là pour le
  dire. Nommer la colonne « gérant » puis y ranger un président écrivait une qualité fausse dans un
  registre légal.
- **Renommage des colonnes, pas seulement des libellés** : une base qui dit « gérant » sous un écran
  qui dit « dirigeant » finit toujours par ressortir dans un export, un CSV Foncia ou une requête
  d'appel de fonds.
- ⚠ **Le MANDATAIRE n'est pas renommé** : « mandataire » est bien la catégorie, pas une fonction. La
  distinction de la 037 reste entière — le dirigeant engage la société, le mandataire relaie.
- ⚠ **Fenêtre de désynchronisation, à connaître pour les prochains renommages** : le code lit en
  `select *`, donc l'affichage survit immédiatement à la migration ; c'est l'ÉCRITURE qui casserait
  tant que le code n'est pas déployé. D'où l'ordre migration puis push, dans la foulée.
- **0B 202 confirmé** par Pascal : le fixe genevois d'Antoine Maurice est le bon numéro.
- ⚠ **`dirigeant_fonction` recopie le registre officiel (gouv.fr), « autre » compris.** J'avais pris
  ces « autre » pour un champ bâclé et proposé de les préciser ; Pascal a corrigé : c'est la qualité
  telle que l'État l'enregistre. **Ne pas les « nettoyer »** — ce serait substituer une hypothèse à
  une source officielle dans un registre légal.
- **0B 474+263** : les deux dirigeants de la SCI Ravoire sont complets (Christian Lüscher et Valérie
  Schwitzgebel Lüscher), avec e-mails et téléphones distincts. ⚠ L'adresse de Valérie vient du
  carnet d'adresses, **pas** du mailing du 18/08 — l'adresse de convocation de la SCI reste celle de
  Christian.

## Session 2026-08-28 (suite) — co-gérance des SCI (041 ✅ appliquée)

- **✅ Second gérant** (`gerant_nom_2`, `_fonction_2`, `_email_2`, `_telephone_2`). Constat de
  Pascal : « les SCI ont souvent plusieurs dirigeants mais on ne note que le gérant ». Ce n'est pas
  cosmétique — **l'un comme l'autre engage la société**, donc vote et signe pour elle en AG. Le
  registre était muet sur celui qui se présenterait.
- **⚠ Pas de seconde adresse** : `adresse_gerant` reste unique, c'est en pratique le siège. Deux
  co-gérants d'une même SCI se joignent au même endroit, et une colonne pour un cas jamais
  rencontré se paierait à chaque lecture.
- Limite assumée, la même que pour les indivisaires : **deux** gérants nommés, pas trois.
- ⚠ Ne pas confondre avec le **mandataire** (037) : le gérant est un organe de la société et
  l'engage, le mandataire ne fait que relayer. Un second gérant reste un dirigeant.
- Les dirigeants suivent la **société propriétaire** : ils ne s'héritent jamais à la mutation et
  restent attachés à l'ancien propriétaire dans l'historique.
- Corrigé au passage : un « Lot introuvable » qui avait survécu au passage au vocabulaire
  « parcelle ».

## Session 2026-08-28 — deux propriétaires ≠ indivision (040 ✅ appliquée)

- **✅ `proprietaires.est_indivision`.** La 038 avait appelé « indivision » le second propriétaire ;
  c'était **présumer la forme juridique**. Correction de Pascal : deux personnes peuvent détenir un
  bien sans être en indivision (communauté entre époux, tontine, démembrement). `nom_2` & co.
  constatent le **fait**, la case à cocher porte la **qualification**. Le registre constate, il ne
  qualifie pas à la place du notaire.
- `not null default false` : non cochée, la case dit « on ne l'affirme pas », pas « ce n'en est pas
  une ». Un booléen nullable aurait donné trois états pour une information qu'on ne saisit qu'en la
  sachant. Les 4 indivisions connues sont **rétro-cochées** par la migration, sur les libellés
  « IND » du syndic — là, la qualification est établie, on ne la devine pas.
- **Les totaux distinguent désormais les deux** : « dont N à deux noms, M en indivision ».
- **✅ Le second propriétaire a ses PROPRES coordonnées dans la liste** (e-mail et téléphone), sous
  un filet de séparation : rien n'oblige deux copropriétaires à partager une adresse, et c'est même
  l'inverse quand la détention naît d'une succession. La recherche les atteint aussi — affiché mais
  introuvable, cela n'aurait servi à rien.
- ⚠ La qualification suit la **période**, comme le reste : elle ne s'hérite jamais à la mutation, et
  reste attachée à l'ancien propriétaire dans l'historique.
- **0B 205 corrigé** : le téléphone du propriétaire était celui de François Perrin (trouvé via
  l'adresse partagée `perrin-floc@`), alors que la propriétaire nommée est **Corine Trosselli**
  (arbitrage Pascal). Son mobile passe en `telephone`, celui de François en `telephone_2`.
  ⚠ **À confirmer** : rien n'établit que François soit copropriétaire — s'il ne l'est pas, son
  numéro doit sortir du registre.

## Session 2026-08-27 (suite 7) — TÉLÉPHONES : 32 parcelles

Source : `all contacts.vcf` (1 134 fiches, tout le carnet de Pascal). Aucune migration.

- **✅ 32 téléphones de propriétaire**, 1 second indivisaire (0B 244), 1 mandataire (0B 220).
  Colonne **uniformisée** au format compact international — les 5 numéros déjà en base étaient
  espacés.
- **⚠ POURQUOI LES NUMÉROS MANQUAIENT** : ils vivent sur des fiches DIFFÉRENTES de celles qui
  portent l'e-mail (une fiche « ASL » avec l'adresse, une fiche personnelle avec le mobile). Le
  rapprochement par e-mail — clé exacte — n'en trouve que **12**. Les 20 autres viennent d'un
  rapprochement par NOM, qui est précisément la méthode qui produit les faux.
- **MÉTHODE DE VÉRIFICATION, à reprendre telle quelle** : chaque numéro a été **remonté jusqu'à la
  fiche qui le porte**, pour vérifier que le nom ET le prénom concordent avec le registre et que
  l'e-mail de la fiche, quand elle en a un, est bien celui du colotis. C'est ce qui a écarté les
  homonymes et les proches : Janine Pargoux (**l'ancienne propriétaire**), Ursula Vidal, Amanda
  Pisigot, Dany Delisle, Jérôme Coluni, Roland et Catherine Perrin. Poser un numéro juste sur la
  mauvaise parcelle est l'erreur qui ressort un jour dans un appel de fonds.
- **RÈGLES APPLIQUÉES** quand une personne a deux numéros : on garde le **mobile** (0B 207, 0B 242)
  — un registre sert à joindre quelqu'un. Quand les deux numéros sont ceux de deux personnes
  distinctes et que la parcelle a un `nom_2`, ils vont en `telephone` / `telephone_2` (0B 244).
- **⚠ 0B 201 : le numéro de Marc Pais n'est PAS posé**, alors qu'il était disponible. Le
  propriétaire est **Pais Tino** ; Marc est associé de la SCI et membre du CS — ses coordonnées
  sont dans « Membres du CS », pas ici. Même arbitrage que pour son e-mail.
- **EN ATTENTE, non écrit** :
  - **0B 689** — le seul numéro trouvé est celui de **Jean-François** Hartwig, alors que la
    propriétaire est désormais **Estelle**. On ne pose pas le téléphone d'un tiers sur la fiche
    d'une autre.
  - **0B 205** — le mobile de Corine Trosselli-Perrin existe en plus de celui de François Perrin,
    mais on ignore lequel des deux figure en second indivisaire.
  - **0B 474+263** — Valérie Luscher a son mobile, mais la parcelle appartient à une **SCI**, pas à
    une indivision : il n'y a qu'une case téléphone, et elle porte celui de Christian.
  - **0B 202** — les deux numéros d'Antoine Maurice sont des fixes (Genève et France) ; le suisse a
    été retenu **sans conviction**, à confirmer.

## Session 2026-08-27 (suite 6) — COORDONNÉES DES COLOTIS : 49 parcelles joignables sur 50

Source : six exports vCard déposés par Pascal dans `_1_lotissement/propriétaires` (105 fiches, très
redondantes). **Aucune migration** — uniquement des `update` sur des colonnes existantes.

- **✅ 46 e-mails de propriétaire, 5 téléphones, 4 mandataires.** Seule **0B 210** (SCI Entre Lac et
  Montagne) reste sans aucun contact.
- **Écrit UNIQUEMENT `email`, `telephone` et `mandataire_*`.** Aucun nom du registre n'a été écrasé
  par celui d'une fiche de contact : les orthographes divergent trop, et le registre avait déjà été
  corrigé une fois. Même règle que pour l'import Foncia, en sens inverse.
- **Arbitrages de Pascal** (questions posées AVANT tout écrit, à sa demande) :
  - **0B 201, SCI Logudoro** : deux adresses. Le propriétaire est **Pais Tino** ; Marc Pais est
    associé de la SCI **et membre du CS**. Ses coordonnées n'entrent donc **pas** au registre des
    propriétaires — elles ont leur place dans « Membres du CS ». `gerant_nom` corrigé en Pais Tino.
  - **Mandataires** : 0B 198 (Nayla Akel), 0B 229 (Mehdi — le gérant nommé est Jassim Al Sulaiti,
    ce n'est donc pas lui), 0B 240, et 0B 220 (Mme Haumont, sur réponse explicite de Pascal —
    ⚠ il doit encore le lui confirmer, un retrait éventuel est un simple UPDATE).
  - **SCI dont le contact EST le gérant nommé** (Le Clapotis, Kitka, Ravoire, Logudoro) : l'adresse
    va dans l'**e-mail du propriétaire**, `gerant_email` restant vide tant qu'on n'en connaît pas
    une seconde, distincte.
  - Les noms de fichiers (« absents », « missing ») ne sont **pas** consignés : si cela désigne des
    absents à une AG, c'est un constat de séance, pas une donnée de registre.
- **⚠ TROIS ADRESSES ÉCARTÉES, délibérément** :
  - `dominique.naz@ipsofacto.notaire.fr` au nom de **M. Gogler**, ANCIEN propriétaire de 0B 210 :
    c'est une **étude notariale**, ni le propriétaire actuel ni un mandataire établi. C'est
    pourtant la seule piste connue pour joindre la SCI Entre Lac et Montagne — **piste à exploiter,
    pas donnée à écrire**.
  - `juliendecima@gmail.com` (0B 232) : seconde adresse de **Julien** lui-même, alors qu'`email_2`
    doit porter celle de la **seconde indivisaire**. Laissée vide plutôt que fausse.
  - `a-holding@orange.fr` (0B 208, Pflieger) : posée en e-mail de la propriétaire puisque c'est ce
    que porte sa fiche, mais **elle a tout d'une société** — à rebasculer en mandataire si Pascal
    le confirme.
- **⚠ PIÈGE RENCONTRÉ, à retenir** : un `update ... from (values ...) join lots on numero` **ne
  remonte aucune erreur** quand un numéro ne matche plus — il écrit simplement une ligne de moins.
  L'adresse de Luscher a été perdue en silence parce que la parcelle avait été renommée `0B 474` →
  `0B 474+263` entre-temps. **Compter les lignes écrites après coup est le seul filet.**
- Travail mené **en parallèle d'une autre session** sur la même base (import Foncia + migration
  039). Périmètres disjoints et explicitement convenus : `email` / `telephone` / `mandataire_*`
  ici, `adresse_communication` / `numero_syndic` là-bas. Les deux dépouillements des vCards ont été
  faits séparément et **donnent exactement les mêmes chiffres** — 49 parcelles joignables sur 50.

## Session 2026-08-27 (suite 5) — liste Foncia importée + n° syndic (039 ✅ appliquée)

- **✅ 48 adresses de communication officielles** importées depuis la liste Foncia (PDF fourni par
  Pascal). Le registre n'en avait aucune. **Seule `adresse_communication` a été écrite**, et jamais
  un nom : les libellés Foncia divergent des noms usuels, et le registre avait déjà été corrigé.
- **✅ `lots.numero_syndic`** (migration 039) — la référence **Foncia**, présente dans tous les
  appels de fonds. Arbitrage de Pascal : « les numéros Foncia sont les numéros de Foncia ; les
  numéros de lot sont ceux du cadastre officiel transmis par la Mairie. » D'où une colonne dédiée
  plutôt qu'un écrasement de `numero`. **Sans unicité** — référence étrangère, tenue par un tiers.
- ⚠ **LA PARCELLE 263 EST PARTAGÉE À 81 / 19 %** entre deux propriétaires ; elle a été divisée mais
  est **restée une seule parcelle** au cadastre. C'est l'explication des `nombre_lots` 1,81 et 1,19,
  et la raison pour laquelle **deux lignes citent la 263** (`0B 247+263`, `0B 474+263`). Repéré
  parce qu'un numéro de syndic ne trouvait pas sa parcelle — **ce n'est pas un doublon** : en
  « nettoyer » un effacerait 19 % d'un lot de l'assiette des voix et des charges.
- **Découverte consignée** : la numérotation Foncia est codée par zone (1xx = A … 5xx = E), continue
  dans chaque zone, et couvre exactement **51 numéros** — le nombre de lots. Le seul non attribué
  (503, zone E) est le lot partagé de la parcelle 263. Cela **n'en fait pas** la numérotation
  officielle du lotissement : seule la Mairie fait foi, et elle transmet des **parcelles**.
- **✅ 4 indivisions nommées** (second propriétaire renseigné), une correction de titulaire et un
  numéro de voirie corrigé, tous tranchés par Pascal sur pièces.
- **RESTE À FAIRE** (arbitré, pas encore saisi) : une parcelle de zone A a changé de propriétaire —
  **mutation à enregistrer avec sa vraie date** (le champ « Date de la mutation » est libre, c'est
  lui qui clôt une période et en ouvre une autre). Une autre attend confirmation d'un nom auprès du
  colotis. Deux adresses non importées : l'une tronquée dans la source, l'autre périmée chez Foncia.
- ⚠ **PIÈGE DES IMPORTS PAR JOINTURE, rencontré deux fois le même jour.** Un
  `update … from (values …) join lots on l.numero = v.numero` **n'échoue jamais** quand un numéro
  ne correspond plus : il écrit simplement **une ligne de moins, en silence**. C'est ainsi qu'un
  renommage de parcelle (`0B 474` → `0B 474+263`) a fait sauter une adresse sans le moindre message.
  **Toujours terminer un import par un COMPTE**, et le comparer au nombre attendu — c'est le seul
  filet. Le 49/50 obtenu sur les numéros de syndic est précisément ce qui a permis de découvrir le
  partage de la parcelle 263.
- ⚠ **Aucun script d'import n'est versionné** — données personnelles. Ils sont reproductibles depuis
  le PDF Foncia et le classeur des votes.

## Session 2026-08-27 (suite 4) — nombre de lots + indivision (migration 038 ✅ appliquée)

- **✅ `lots.nombre_lots`, à 1 par défaut.** Le registre compte 50 parcelles mais **51 lots** : deux
  parcelles pèsent 1,81 et 1,19. L'en-tête annonçait donc « 50 lots », un chiffre faux.
  ⚠ **Arbitrage de Pascal** : plutôt que de **taire** le total (ma première réponse), porter le
  nombre de lots **sur chaque parcelle**. Le registre redevient capable de compter juste, et les
  deux exceptions cessent d'être une note en observations que personne n'additionne. Le total se
  **somme sur la colonne**, jamais sur le nombre de lignes.
- **✅ Indivision : deux propriétaires sur UNE ligne** (`nom_2`, `email_2`, `telephone_2`). Une
  indivision, c'est une part de charges, une voix, une période. Deux **lignes** compteraient la
  parcelle, la superficie, les voix et les charges **en double** — et l'index partiel
  `proprietaires_actuel_par_lot` l'interdit à juste titre. Une indivision compte pour **UN**
  propriétaire dans les totaux, avec un « dont N en indivision » en détail.
  ⚠ Limite assumée : **deux** indivisaires, pas trois. Un troisième se note en observations en
  attendant une vraie table — qui coûterait une jointure à chaque lecture pour un cas inexistant.
- **✅ Vocabulaire remis d'aplomb** : l'écran dit « parcelle » là où il disait « lot » (colonne,
  titre de fiche, champ, recherche). `lots.numero` porte la parcelle cadastrale ; le **lot**, lui,
  est désormais un **nombre** porté par `nombre_lots`.
- ⚠ Le **tantième reste calculé sur la superficie**, pas sur `nombre_lots` : le vote en AG est au
  prorata des superficies, pas du nombre de lots.

## Session 2026-08-27 (suite 3) — mandataire ≠ gérant (037 ✅ appliquée), totaux, tri mémorisé

- **✅ Le MANDATAIRE est séparé du GÉRANT** (migration 037). Contresens de la 036 corrigé par
  Pascal : « le mandataire n'est pas le gérant, qui est le gérant de la SCI. C'est le cas pour les
  étrangers, on parle avec des intermédiaires. » Le gérant est un **organe de la société** (il
  n'existe que si le propriétaire en est une, et il l'engage) ; le mandataire est un **relais**
  (agence, conseil, famille) qui peut exister sur une **personne physique**, et une SCI peut avoir
  son gérant à l'étranger ET un mandataire sur place. Trois colonnes neuves plutôt qu'un renommage.
  Les `gerant_*` de la 036 sont **conservées** : seul leur libellé à l'écran était faux.
  ⚠ Le mandataire suit le PROPRIÉTAIRE : il ne s'hérite **jamais** à la mutation.
- **✅ Totaux en en-tête** : lots au registre, propriétaires actuels (+ lots vacants), superficie
  totale. Le compte des propriétaires est **distinct** de celui des lots — un lot vacant n'en a pas.
- **✅ Tri mémorisé** par navigateur (`localStorage`), avec retour silencieux au tri par défaut si le
  stockage est indisponible ou si la colonne mémorisée n'existe plus. C'est un confort d'affichage
  propre à la personne et à son poste : **rien à faire en base**.
- La recherche couvre désormais aussi le nom du mandataire.

## Session 2026-08-27 (suite 2) — REGISTRE ALIMENTÉ : 50 lots, 104 646 m²

- **✅ Les 50 lots et leurs propriétaires actuels sont en base**, importés de
  `4_ASL/_résultats des votes/Résultats des votes.xlsx`, onglet « Colotis & Superficie ». Le total
  des superficies tombe **exactement** sur celui du classeur (104 646 m²) — c'est le contrôle qui
  valide la lecture du fichier.
- ⚠ **`lots.numero` = la PARCELLE CADASTRALE**, pas un numéro de lot. Le fichier source n'en porte
  aucun : sa colonne « N° » est le numéro de voirie, sa colonne « lot » un **nombre** de lots
  (1, sauf 1,81 et 1,19 — d'où 51 lots pour 50 colotis). La parcelle est le seul identifiant réel,
  unique et vérifiable, et c'est déjà elle qui désigne les colotis dans les listes de vote de l'ASL.
  ⚠ Si la numérotation d'origine du lotissement (le cahier des charges de 1955 parle de « lot n°13,
  zone A ») refait surface avec sa correspondance aux parcelles, c'est **un simple UPDATE**.
- **Le libellé exact du syndic est conservé** en observations de chaque propriétaire. Il diverge du
  nom usuel dans plusieurs cas — « BERJEMO » vs *Bermejo*, « CHAPPUIS LUCIENNE » vs *Chappuis
  Olivier*, « DELISLE PAUL » vs *Delisle Florian*, « PARGOUX JEAN-CLAUDE » vs *Pargoux Anne*,
  « TKATCHOUK » vs *Katchouk* : successions ou fautes du fichier Foncia. **Rien n'a été tranché** ;
  les deux versions sont en base et se corrigent à l'écran.
- **Ni e-mail ni téléphone** : la source n'en contient pas. L'onglet « source » du même classeur est
  un carnet d'adresses général, **pas** la liste des colotis — ne pas l'importer sans tri.
- ⚠ **Le script d'import n'est PAS versionné**, délibérément : 50 noms et adresses de tiers dans un
  dépôt git, c'est exactement ce que la mention RGPD interdit de diffuser. Il est reproductible à
  partir du classeur ; l'exemplaire de travail est resté hors dépôt.
- **Écueil rencontré, à retenir** : l'éditeur SQL de Supabase a rejeté le script complet sur une
  ligne contenant `/` et `:` dans une chaîne (« invalid binary integer at or near 0B » — le
  parseur avait perdu le fil des guillemets bien avant la ligne signalée). Remède appliqué, le même
  qu'aux incidents du 2026-08-25 : **caractères spéciaux bannis des chaînes** (`:`, `/`, `&`,
  tirets cadratins) et **script découpé en blocs courts**, chacun vérifié. Les accents ont été
  reposés dans un 3ᵉ bloc — dans un registre légal, « Allee de Rives » n'est pas l'adresse.

## Session 2026-08-27 (suite) — superficie des lots + mandataire (migration 036 ✅ appliquée)

- **✅ `lots.superficie`** — c'est une **assiette**, pas une donnée descriptive : poids de vote en
  AG (prorata des superficies) et répartition des charges. Une superficie fausse produit un vote
  faux et un appel de fonds faux. `numeric(10,2)`, contrainte « > 0 si renseignée » — un lot dont
  on n'a pas encore la surface doit rester saisissable.
- **✅ Tantième DÉRIVÉ, jamais stocké** : part = superficie / somme des superficies renseignées.
  Le stocker divergerait dès qu'un lot serait ajouté ou corrigé, et les parts continueraient
  d'avoir l'air justes. La liste affiche le **total et le nombre de lots renseignés**, et signale
  que les parts sont **provisoires** tant qu'il en manque — un tantième calculé sur un registre
  incomplet est faux, le taire serait pire que ne rien afficher.
- **✅ Email et téléphone du mandataire** (`gerant_email`, `gerant_telephone`). Colonnes préfixées
  `gerant_` comme les trois existantes : « gérant » et « mandataire » désignent la même personne,
  renommer l'ensemble n'aurait rien gagné. ⚠ Le trigger de normalisation d'e-mail écoute désormais
  **les deux colonnes** — limité à `email`, une correction de l'adresse du mandataire serait passée
  à côté.
- **Piste non faite** : `m2_presents` d'une AG pourrait être rapporté au total des superficies pour
  afficher un pourcentage de présence. Le registre fournit désormais le dénominateur. Le relevé de
  présence, lui, reste un constat de séance et doit rester saisi.

## Session 2026-08-27 — REGISTRE DES PROPRIÉTAIRES (migration 035)

- **✅ Registre des membres de l'ASL**, réservé au **président et au secrétaire** — lecture comme
  écriture. ⚠ **Première table de l'app contenant massivement des données personnelles de tiers.**
  `lots` et `proprietaires` ne sont **PAS** dans la boucle `read_auth` : aucun accès par défaut,
  policies dédiées `is_admin() or is_secretaire()`. Un trésorier ne voit rien.
- **Modèle : le LOT est stable, le propriétaire est une PÉRIODE.** Propriétaire actuel =
  `date_cession is null`, historique = les autres, mutation = clôture d'une période + ouverture de
  la suivante. Pas de table `mutations` à tenir en plus. **Index partiel** garantissant un seul
  propriétaire actuel par lot — sans lui une mutation mal terminée fausserait le registre en silence.
- **✅ Mention RGPD** acceptée une fois par personne, horodatée et tracée. L'écran s'affiche **à la
  place** du registre : une mention lisible par-dessus les données qu'elle protège ne protège rien.
  Un rappel court reste ensuite en tête à chaque consultation. Texte dans `src/lib/rgpdRegistre.js`.
- **✅ Liste triable** par colonne (lot, propriétaire, adresses, email, téléphone) ; tri du lot en
  `numeric` pour que le 10 suive le 9. **Saisie sur la fiche**, comme demandé.
- ⚠ **Ce registre EST le rôle des colotis** attendu par le chantier d'onboarding gelé : il en lève
  le préalable principal (§4.2 de la spéc). Il n'ouvre pour autant **aucun accès** — le chantier
  reste gelé, et la spéc devra être relue à la lumière de ce que ce registre contient réellement.
- **À FAIRE** : alimenter depuis les fichiers du syndic (Pascal les fournira). Le seed de démo est
  **volontairement vide** — inventer noms et adresses de personnes dans un jeu de démonstration
  serait exactement ce que la mention interdit.
- **À FAIRE** : faire relire la mention par Me Garnier si on veut qu'elle ait une valeur opposable.
  En l'état, c'est une règle de conduite interne clairement énoncée, pas un avis juridique.

## Session 2026-08-26 (suite 4) — numéro à la soumission + date limite (migration 034)

- **✅ Le numéro est attribué À LA SOUMISSION, plus à la création.** Défaut réel signalé par
  Pascal : un brouillon réservait un numéro, et l'abandonner laissait un **trou définitif** dans le
  registre — or un numéro manquant se lit comme une délibération retirée. `numero` devient
  nullable ; le trigger `decisions_cycle_guard` l'attribue au moment où la décision entre au
  registre. Plus de trou, et l'ordre suit les soumissions réelles.
- **⚠ Le piège traité : la CONCURRENCE.** Le numéro se calcule en « max + 1 ». Deux décisions
  planifiées ouvertes par la MÊME commande SQL verraient le même instantané et tireraient le même
  numéro — l'unicité ferait échouer tout le cron. `ouvrir_decisions_planifiees` est donc réécrite
  **en boucle**, un update par décision. Ne pas « optimiser » en update de masse.
- `prochain_numero_decision` (RPC de la 026) est **supprimée** : plus d'appelant, et laisser un
  `security definer` inutile est une surface pour rien.
- **✅ Date limite masquée dès l'enregistrement** (liste et fiche) : elle ne concerne que le vote en
  cours. La liste montre à la place « enregistrée le … », seule date qui compte une fois l'acte posé.
- **✅ Tri du registre rendu déterministe** : publication décroissante, **puis numéro décroissant**.
  Sans ce second critère, les décisions d'un même jour sortaient dans un ordre non garanti et les
  deux backends pouvaient diverger (même défaut que celui corrigé sur les projets).

## Session 2026-08-26 (suite 3) — rattacher une décision ENREGISTRÉE à un projet (033)

- **✅ Une décision enregistrée peut rejoindre un projet ouvert après coup.** Cas courant signalé
  par Pascal : le CS vote l'attribution d'un marché, le chantier ne s'ouvre qu'ensuite.
- **Le verrou fige la DÉLIBÉRATION, pas le classement** — texte, votes, composition, montant
  restent intouchables ; `projet_id` est un rangement. **Rien n'était verrouillé en base**
  (`write_admin` suffisait) : le blocage était dans l'ÉCRAN, qui refuse toujours d'ouvrir le
  formulaire d'une décision enregistrée. Chemin **étroit** (`rattacherDecisionProjet`), réservé au
  président, **tracé** dans `audit_log` — modifier une ligne du registre sans empreinte serait le
  vrai problème.
- ⚠ Ne touche QUE `projet_id` : `resolution_id` et `ag_id` sont **conservés**, contrairement au
  formulaire de création qui les efface. Sur une ligne figée on ne détruit rien. Sans double compte
  — `computeAGBudgets` ne compte en direct que les décisions sans projet (vérifié : l'engagement
  bascule de l'enveloppe vers le projet, 5 800 € dans les deux sens).
- La carte annonce le **restant du projet après rattachement** et signale un dépassement, sans
  l'interdire : l'argent est déjà engagé, refuser ne le ferait pas disparaître — cela laisserait
  seulement la décision rangée nulle part.

## Session 2026-08-26 (suite 2) — sous-numérotation des résolutions (migration 032)

- **✅ « 10-1 / 10-2 / 10-3 »** — problème de MODÈLE signalé par Pascal, pas de confort : une
  résolution du PV (revalidation du budget de 3 projets) doit donner **3 lignes** dans l'app,
  parce que `resolutions_ag.projet_id` est scalaire et qu'une enveloppe passe en ENTIER dans un
  projet. Sans sous-numéro, il fallait inventer 3 numéros absents du PV.
- **Deux entiers, pas un texte** : `sous_numero integer not null default 0`, unicité sur
  `(ag_id, numero, sous_numero)`. En texte, « 10-1 » se rangerait avant « 2 » — il aurait fallu
  une clé de tri séparée, donc deux colonnes de toute façon, avec un format libre invalidable.
  `0` plutôt que `NULL` : l'unicité fonctionne sans dépendre de `nulls not distinct` (PG 15+).
- Affichage `numeroResolution`, saisie relue par `parseNumeroResolution` (champ texte « 10 » ou
  « 10-1 »), tri `compareResolutions` **partagé par les deux backends**. Le libellé sous-numéroté
  remonte jusqu'au **CSV Foncia** et aux écrans de budget.
- `nextResolutionNumero` et la zone de garage ignorent les sous-rangs : proposer « 11 » après une
  10-3, et garer en résolution simple.

## Session 2026-08-26 (suite) — numérotation des résolutions + PJ sur l'AG (031)

- **✅ Numéro de résolution SAISISSABLE.** Il doit reprendre celui de la **convocation**, que
  l'ordre de saisie ne reproduit pas. `nextResolutionNumero` n'est plus qu'un défaut à la création.
  Unicité `(ag_id, numero)` validée **à l'écran** avant l'envoi (le message Postgres serait
  illisible). Le tri par numéro, lui, était **déjà en place** des deux côtés — rien à changer.
  **Zone de garage ≥ 101** : imposer un numéro déjà pris ne bloque plus — l'occupante est déplacée
  au premier numéro libre à partir de 101 (confirmation qui nomme les deux), part en fin de liste
  avec un badge « à renuméroter ». Sans ça, renuméroter selon la convocation obligeait à libérer le
  numéro d'abord, donc à renuméroter l'autre, qui butait à son tour. `nextResolutionNumero` ignore
  la zone de garage, sinon la numérotation réelle partirait à la dérive.
  ⚠ Le verrou de `updateResolution` empêche de renuméroter — donc aussi de garer — une résolution
  déjà engagée par une décision ou un projet : l'écran refuse alors et demande un autre numéro.
- **✅ Pièces jointes sur l'AG** (migration 031) : `assemblees_generales.documents` + une
  `categorie` (convocation / PV / autre) dans le jsonb. La convocation et le PV ne se rattachent à
  aucune résolution. **Aucune policy de Storage à ajouter** — le préfixe `ag/…` est couvert par
  construction (012 n'exclut que les décisions enregistrées, 026 ne vise que `decisions`).
  ⚠ **Attachable même sur une AG clôturée** : le PV arrive après la clôture. Même exception, et
  même raison, que le rattachement des enveloppes aux projets.
  `pv_url` (lien externe hérité) est conservée — à supprimer un jour, si plus aucune AG ne s'en sert.
- **✅ Tri des projets : date de début DÉCROISSANTE, puis titre.** Au passage, correction d'une
  **divergence entre backends** que le mode démo masquait : le mock triait sur `created_at`
  décroissant, Supabase ne triait **pas du tout** (ordre rendu par Postgres). Un comparateur unique
  `compareProjets` (`projetLogic.js`) est désormais appelé par les deux `listProjets` — donc aussi
  par la page Budgets, qui lit la même méthode. Un projet **sans date de début part en fin de
  liste** : il n'a pas commencé. `localeCompare` en français pour les accents.

## Session 2026-08-26 — journal de bord des projets (migration 029)

- **✅ JOURNAL DE BORD par projet** (`journal_projet`) : ce que l'équipe a FAIT, daté du jour où
  cela s'est passé. ⚠ **À ne pas confondre avec `audit_log`** — celui-là est automatique, technique
  et immuable ; celui-ci est saisi à la main, métier, et **corrigeable**.
- **✅ Deux dates, et c'est tout l'objet de la demande** : `date_action` (**modifiable**) et
  `created_at` (jamais modifié). Tri sur la date de l'**action** : une visite du 12 notée le 20 se
  range au 12, sinon le journal mentirait sur la chronologie. ⚠ La date de saisie est **stockée mais
  plus affichée** (Pascal, 2026-08-26) : une entrée tient sur **une ligne** — date, sujet, boutons,
  auteur.
- **✅ L'auteur seul corrige et supprime sa ligne.** Volontairement borné : le chef et l'adjoint
  pilotent le projet, ils ne réécrivent pas le compte rendu d'un autre. Le président garde tout.
  Aucun verrou de temps — ce n'est pas une délibération.
- **✅ Statut projet « En préparation »** (signalé par Pascal, voir la session précédente).
- **✅ Cycle de projet resserré à QUATRE états** : `en_preparation` → `en_cours` →
  (`suspendu` ⇄ `en_cours`) → `termine`. **`ouvert` supprimé**, fondu dans `en_cours` : il
  distinguait « ouvert mais rien d'engagé » de « en cours », nuance vidée de son sens depuis que
  `en_preparation` existe. `engage` n'entre donc plus dans le calcul du statut. **Aucune migration**
  — tout reste dérivé.
- **✅ Dates de début et de fin dans la liste des projets.** Une date de fin vide est le cas normal
  d'un projet en cours, pas une donnée manquante : `formatDate` affiche « — ».
- **⛔ Bouton « suspendre / reprendre » : demandé puis RETIRÉ le jour même**, avant livraison
  (Pascal : « la suspension et la reprise et la fin se font par une décision donc pas de bouton »).
  Ce qu'il faut retenir si l'idée revient : un bouton obligerait à **stocker** la suspension
  (colonne `suspendu_le`), donc à rouvrir la porte que la migration 011 avait fermée en supprimant
  `projets.statut`. La migration 030 correspondante a été écrite puis **supprimée sans jamais être
  appliquée** — la base n'a pas bougé.

## Session 2026-08-25 (suite) — adjoint de projet + fil d'échanges (migration 028)

- **✅ ADJOINT au chef de projet** — `projets.adjoint_projet_id`, facultatif, forcément un **autre**
  membre du CS (FK vers `membres_cs` + contrainte `is distinct from` le chef). **Exactement les
  mêmes droits que le chef** : la policy `projets_chef_update` accepte désormais l'un ou l'autre.
  Motif (Pascal) : « vu l'emploi du temps des uns et des autres », un projet ne peut pas reposer
  sur une seule personne. La **suppression** reste au président, comme avant. À noter : la lecture
  étant déjà ouverte à tout membre connecté, ce que l'adjoint gagne réellement, c'est le droit
  d'**écrire** sur le projet.
- **✅ FIL D'ÉCHANGES par projet** — table `questions_reponses_projet`, même forme que le fil des
  décisions (questions + réponses + commentaires de suivi). **Différence tenue** : une décision se
  fige à l'enregistrement et son fil se ferme (migration 021) ; un projet ne se fige jamais, donc
  aucune garde de verrouillage. Ouvert à **tout membre du CS actif**, pas au seul binôme
  chef/adjoint : le conseil doit pouvoir poser une question sans convoquer une réunion.
- **✅ Statut projet « En préparation »** (signalé par Pascal) — un projet dont la `date_ouverture`
  est à venir, typiquement calé après une AG, était annoncé **« Ouvert »** dès sa création. Il ne
  l'est pas. Nouveau statut **dérivé**, sans colonne ni migration, sur le patron d'`effectiveAGStatut`
  (023) : le projet bascule « Ouvert » tout seul le jour dit. Ordre de lecture du statut naturel,
  premier cas gagnant : argent engagé → `en_cours` (un engagement voté prime sur un calendrier),
  puis ouverture à venir → `en_preparation`, sinon `ouvert`. Le formulaire prévient quand la date
  saisie est future, pour qu'on ne prenne pas « En préparation » pour un bug.
- **✅ Rôle « membre d'équipe » VISIBLE mais non assignable** — une carte « Équipe projet » sur la
  fiche montre les trois rôles ; le troisième affiche « — à venir — » et dit pourquoi. Choix
  explicite de Pascal : rendre le rôle visible sans coder le mécanisme tant que l'onboarding des
  colotis n'est pas spécifié. **Aucun bouton** — le CS doit pouvoir se projeter sans croire que
  c'est déjà possible.
- ⚠ `questions_reponses_projet.auteur_id` pointe `membres_cs` : le fil est donc réservé au CS.
  C'est exactement la ligne que devra franchir le chantier colotis, sans quoi un membre d'équipe ne
  pourra pas écrire dans le fil — sa raison d'être.

## Session 2026-08-25 — décisions en brouillon + soumission planifiée (migration 026)

Implémentation de `Spec_Decisions_Brouillon_Planifie.md` (dossier parent, hors dépôt).
Besoin déclencheur : la **règle de représentation et de contacts extérieurs** doit être soumise au
vote **après l'AG du 15 septembre 2026**, comme premier acte du conseil nouvellement désigné.

> ✅ **Migration 026 appliquée en prod le 2026-08-25**, bloc par bloc, avec vérification à chaque
> étape : colonnes (5 décisions toutes restées `ouverte_au_vote`), les 2 tables, les 2 fonctions +
> le trigger, les 8 policies, et **pg_cron 1.6.4 activé** avec la tâche horaire
> `ouvrir-decisions-planifiees` (jobid 1, active).
> ✅ **Code déployé** (commits `70e1253`, `c5ad6cb`, `d3d4171`), puis **migration 027** appliquée :
> trace d'audit de la visibilité, et retrait de la ratification en réunion.

- **✅ `phase` ≠ `statut`** — nouvelle colonne `decisions.phase` (`brouillon` / `planifiee` /
  `ouverte_au_vote` / `annulee`). `statut` reste le RÉSULTAT de la délibération. **Écart assumé vs
  la spec**, qui fusionnait tout dans `statut` : les budgets, le CSV Foncia et le PDF lisent
  `statut` — y injecter des états de cycle aurait cassé la dérivation des budgets en silence.
- **✅ Gel du texte + empreinte** : à l'ouverture du vote, `contenu_gele` (titre + `\n\n` +
  description) et `hash_contenu` (SHA-256 hex UTF-8). Titre et corps **non modifiables ensuite,
  y compris par l'auteur** — c'est un **changement de comportement** : aujourd'hui l'owner corrige
  une décision ouverte jusqu'à l'enregistrement. Pas de gel rétroactif (la garde porte sur
  `contenu_gele is not null`) ; montant, rattachement et **pièces jointes restent modifiables**.
- **✅ Recalage des dates à l'ouverture** — le point qui fait marcher le cas d'usage :
  `date_publication` est reposée au jour d'ouverture RÉELLE, donc c'est le **conseil désigné le
  15 septembre** qui vote, pas l'ancien (`date_publication` pilote `activeMembersAt` et le quorum).
  `date_limite_reponse` = + `delai_vote_jours` jours **ouvrés**.
- **✅ Un seul point d'application** : trigger `decisions_cycle_guard` (transitions du graphe §3,
  motif d'annulation obligatoire, gel, `version` + `decisions_historique`, recalage). Le repo
  Supabase ne fait que des `update` ; le mock a un miroir explicite (`appliquerCycle`).
- **✅ Ouverture automatique — pg_cron horaire + filet applicatif.** **Écart assumé vs la spec**
  (Vercel Cron + route API) : le projet n'a **aucun code serveur**, et une route de cron exigerait
  la `SERVICE_ROLE_KEY` (qui contourne TOUTE la RLS) dans Vercel, pour un registre légal. Le filet
  (`useOuvertureAutomatique`, dans `Layout`) appelle la même fonction au chargement de l'app :
  sans lui, un pg_cron non activé ferait qu'une décision planifiée ne s'ouvre **jamais**, en
  silence. Idempotent. `cron_runs` ne journalise que les exécutions non vides.
  Cadence horaire et non « 07:00 quotidien » : `date_soumission_prevue` porte une heure.
- **✅ Un brouillon n'appartient QU'À SON AUTEUR** (arbitrage Pascal 2026-08-25). Tant qu'une
  décision est en brouillon — *planifiée* comprise — seul son auteur la voit, la modifie, la
  soumet et la supprime. **Le président n'y a aucun droit de plus qu'un autre membre** : demander
  une décision au conseil n'est pas un pouvoir présidentiel ; sa prérogative propre est l'acte
  (enregistrer une délibération votée) et la signature. Exception assumée à « tout membre connecté
  lit tout ».
  - **Trois** policies restrictives, une par verbe (`decisions_avant_soumission_privee`,
    `…_brouillon_update_auteur`, `…_brouillon_delete_auteur`). Il en faut trois : **un SELECT
    fermé n'empêche ni l'UPDATE ni le DELETE** d'une ligne ciblée par son id — sans la policy
    d'UPDATE, le président pouvait réécrire un brouillon qu'il ne voit pas, ou le **soumettre au
    vote à la place de son auteur**.
  - `decisions_historique` **et** les pièces jointes suivent la visibilité de leur décision —
    sinon le texte et les devis cachés fuyaient par là. Côté Storage, la garde est **additive**
    (`documents_brouillon_prive`, restrictive, à côté de `documents_read_auth` laissée intacte) :
    réécrire la policy de lecture aurait pu, en cas d'échec, laisser le bucket sans lecture.
  - Une décision **annulée reste visible de tous** : annuler = laisser une trace au registre
    (motif obligatoire) ; qui n'en veut pas **supprime**.
  - ⚠ Effet de bord assumé : le brouillon d'un membre devenu inactif n'est plus accessible à
    personne.
- **✅ Suppression, deux régimes disjoints** : décision **non soumise** → son auteur seul
  (`decisions_owner_delete`) ; **soumise et non enregistrée** → le président seul (≤ 1 vote).
  Avant, une simple erreur de saisie obligeait à déranger le président ou à « annuler » — ce qui
  garait pour toujours une décision annulée au registre.
- **⚠ Effet de bord traité — la NUMÉROTATION passe en base.** `prochain_numero_decision(annee)`
  (`security definer`) remplace le `nextNumero` calculé côté client : les brouillons des autres
  étant invisibles, un « max + 1 » sur `listDecisions()` retombait sur un numéro déjà pris →
  violation de l'unique, avec une erreur Postgres illisible. C'est le piège le moins évident de
  toute la session. Le numéro n'est toujours pas *réservé* (collision possible entre deux
  créations simultanées, comme avant).
- **✅ On ne vote que sur une décision ouverte** : policies **restrictives**
  `votes_open_only_insert/update` (permissives = OU, donc `votes_admin` aurait laissé le président
  voter un brouillon). Contrainte `enregistree ⇒ phase = 'ouverte_au_vote'`.
- **✅ Écrans** : registre (filtre par état en 2 groupes, brouillons/planifiées **en tête** avec
  leur date d'ouverture, badge unique `DecisionEtatBadge`, « à voter »/« à notifier » désormais
  réservés aux décisions soumises) ; formulaire (3 actes : *Enregistrer le brouillon* /
  *Planifier la soumission* / *Soumettre au vote maintenant*, durée du vote, visibilité, version +
  dernier auteur, texte en lecture seule si gelé) ; fiche (bandeaux par phase, empreinte SHA-256,
  versions du brouillon, visibilité, annulation avec motif obligatoire).
- **✅ Budgets** : un brouillon ou une décision annulée ne pèse plus sur une enveloppe
  (`peseSurLeBudget`). ⚠ `phase` ajoutée aux 3 `select` de décisions de `supabaseDb.js` — sans
  elle, un brouillon chiffré serait compté « engagé en cours » **en prod seulement**.
- **✅ Visibilité affichée et modifiable** (ajout du 25/08, après coup) : la visibilité prévue
  s'affiche sous le badge d'état dans le registre (gris pour « CS seulement », bleu pour
  « Colotis ») et sur la fiche. **Le président peut la changer sur une décision ENREGISTRÉE**
  (`repo.changerVisibilite`, sans migration : le trigger ne bronche pas, `write_admin` suffit) —
  publier n'est pas délibérer, et le verrou de l'art. 15 protège le texte, pas la décision de qui
  peut le consulter. Avant/pendant la rédaction, c'est l'auteur qui la fixe depuis le formulaire.
  ⚠ Toujours **AUCUN effet** : rien ne lit ce champ, l'accès colotis n'existe pas. La carte de la
  fiche le dit explicitement — ne pas retirer cet avertissement tant que c'est vrai.
- **✅ Trace d'audit du changement de visibilité** (migration 027) — **premier écrit dans
  `audit_log` côté Supabase**, le journal y était resté vide jusqu'ici (seul le mock l'alimentait).
  C'est un **trigger** (`decisions_audit_visibilite`) et non un insert applicatif, pour deux
  raisons : il attrape aussi le chemin du formulaire (le rédacteur sur son brouillon), et
  `audit_log` n'étant écrivable que par `write_admin`, un insert côté client aurait échoué en
  silence pour un membre ordinaire. Même libellé des deux côtés (mock et trigger) : une trace qui
  diffère selon le backend n'est pas une trace. Portée volontairement étroite à la seule
  visibilité — auditer toute la table est un autre chantier (volume, rétention).
- **✅ PDF** : brouillons et planifiées **exclus** du registre (ce ne sont pas des délibérations) ;
  annulées conservées, verdict « ANNULÉE » + motif ; empreinte et ratification imprimées.

**NON fait, et pourquoi** (le dire vaut mieux que le laisser croire) :
- **Aucune notification** (spec §6 : mail à l'ouverture, relance J+3, mail de clôture) ni table
  `notifications_decision`. Il n'existe **aucun envoyeur** — c'est le point « e-mail automatique »
  du backlog, bloqué sur le domaine vérifié + une Edge Function. **Conséquence concrète : le
  16 septembre, le vote s'ouvrira sans que personne soit prévenu.** L'auteur doit passer par
  « Prévenir le CS » (les bandeaux de l'app le rappellent).
- **Aucune clôture automatique du vote** ni `cloturee_le` (spec §2.1/§6) : clôturer = calculer et
  figer le résultat, c'est l'acte du président. La spec elle-même interdit qu'une échéance emporte
  une décision.
- **`visibilite`** est stockée, saisissable, affichée et tracée, mais **n'a toujours aucun
  lecteur** : le registre consultable par les colotis est hors périmètre v1 (spec §9).
- **La ratification en réunion du §4 a été RETIRÉE** le jour même de sa pose (migration 027) — voir
  la ligne dédiée plus haut. Le point juridique se règle par la révision des statuts (AG du 15/09).
- **La décision « Règle de représentation et de contacts extérieurs » (spec §10) n'est PAS créée
  en prod.** Le mode démo en contient une **trame de six articles**, à remplacer par la rédaction
  réelle du conseil : inventer le texte d'une règle qui sera votée n'appartient pas à l'outil.

### ⚠ Piège majeur — l'éditeur SQL de Supabase (5 échecs avant de comprendre)

Son analyseur maison refuse le script **avant même de l'envoyer à Postgres**, avec des messages
d'erreur qui se déplacent à chaque tentative (« mismatched parentheses », « syntax error at or
near DD/UPDATE/check_violation »). Trois constructions pourtant parfaitement valides le font
décrocher — à bannir de toute migration future :

1. **Toute chaîne vide `''`** — il la prend pour une apostrophe échappée, se croit resté dans la
   chaîne, et déraille sur tout ce qui suit. D'où `coalesce(length(btrim(x)), 0) = 0` au lieu de
   `btrim(x) = ''`, et `concat(x)` au lieu de `coalesce(x, '')`. Idem pour une apostrophe échappée
   dans un message (`n''est`). **Y compris dans les commentaires `--`.**
2. **Tout argument de formatage de `raise`** — `raise ... '%…', to_char(x, 'DD/MM/YYYY HH24:MI')`
   le fait tomber. Les messages du trigger sont donc **nus**, sans `%` ni argument.
3. **Un `$job$` imbriqué dans un `$pgcron$`** (bloc `do`) — d'où deux instructions nues pour le
   cron. Cousin du piège des balises `$$` déjà documenté pour la migration 018.
4. **Les requêtes de VÉRIFICATION élaborées** (2026-08-27) : une cascade de `union all`, comme des
   sous-requêtes scalaires dans la liste du `select`, le font décrocher — et c'est d'autant plus
   traître que l'erreur pointe la requête de contrôle, pas le DDL, alors que **tout le script est
   annulé**. Vérifier avec **une requête simple sur une seule source**
   (`select … from pg_policies where …`), jamais avec un tableau de bord fait maison.
5. **Deux fonctions `$$` dans le même script** : utiliser des **balises nommées distinctes**
   (`$normalise_email_prop$`, `$audit_rgpd$`) — c'est le remède déjà appliqué par la migration 018.

Méthode qui a fini par marcher, à réutiliser : **un objet par exécution**, en commençant par le
plus petit, et la vérification dans le même bloc pour éviter de recopier du texte par erreur.
Autre garde-fou appris en route : ne jamais `drop` une policy de lecture pour la recréer — la
nouvelle policy des pièces jointes est **additive** (`documents_brouillon_prive` restrictive à côté
de `documents_read_auth`), pour qu'un échec ne puisse pas laisser le bucket sans lecture.

**Vérifié** : mock passé au crible (refus de vote sur brouillon, version + historique, transitions
interdites, annulation sans motif, gel/hash/recalage, idempotence de l'ouverture automatique,
exclusion budgétaire ; puis, sur la confidentialité : l'auteure voit son brouillon, un autre membre
ne le voit ni en liste ni en fiche, **le président non plus** — et il ne peut ni le modifier, ni le
soumettre, ni le supprimer ; le numéro suivant reste juste malgré les brouillons cachés ; l'auteure
supprime son brouillon mais plus une fois soumis) + parcours
navigateur (registre, fiche brouillon, soumission, formulaire). `npm run lint` / `npm run build`
propres.
**Non vérifié** : la migration SQL n'a **jamais été exécutée** (ni prod ni staging) — trigger,
policies restrictives, pg_cron et `sha256()` côté Postgres restent à éprouver. La recette du hash
a été confrontée à `shasum -a 256` : c'est bien le SHA-256 standard de la chaîne UTF-8, celui que
produit `encode(sha256(convert_to(t,'UTF8')),'hex')`.

## Session 2026-08-05 — pièces jointes sur les résolutions d'AG

- **✅ PJ sur les résolutions d'AG** (migration 025 : `resolutions_ag.documents` jsonb). Même infra
  Storage que décisions/projets (bucket privé `documents`, chemin `resolutions/<id>/…`). **Aucune
  nouvelle policy** : l'insert exige un membre actif, son NOT EXISTS ne porte que sur les décisions
  enregistrées → un chemin `resolutions/…` passe (comme `projets/…`). Upload/retrait dans la
  `ResolutionModal` (`AGDetail.jsx`, id client via `crypto.randomUUID` car l'upload précède la
  création de la ligne) ; **téléchargement par tout membre** depuis la ligne de résolution. Suit le
  verrou de la résolution (pas d'ajout si décision/projet rattaché, ni si AG figée).

## Session 2026-07-30 — chantier AG (heures, cycle, quorum, clôture) + TVA

Tout en prod (migrations 022-024 appliquées à la main). Validé en mock.

- **✅ Heures d'AG** (migration 022) : `heure_planifiee` + `heure_fin` (texte HH:MM). L'heure de fin
  n'est saisissable qu'au stade « AG a eu lieu ».
- **✅ Cycle de statut d'AG révisé** (migration 023). Stockés : `preparation` → `convoquee` →
  `cloturee` (+ `annulee`). **« AG a eu lieu » est DÉRIVÉ** de la date passée (`effectiveAGStatut`
  dans `agLogic.js`), **jamais stocké**. Helper `agAEuLieu` = date atteinte et non figée.
- **✅ Clôture = FIGE l'AG** (bouton « Clôturer l'AG », président, exige l'heure de fin, seulement
  une fois l'AG tenue). AG figée (cloturee/annulee) → plus de modification de l'AG ni des
  résolutions. **EXCEPTION** : le rattachement d'une enveloppe à un projet reste actif (acte
  post-AG). `agFrozen = statut cloturee|annulee`.
- **✅ Données a posteriori** (migration 023) : `quorum_statut` (quorum_atteint / sans_quorum_accepte
  / sans_quorum_rejete) + `m2_presents` (m² présents/représentés). Saisis dans un `<fieldset
  disabled>` activé seulement quand l'AG a eu lieu.
- **✅ TVA sur les décisions** (migration 024) : `tva_taux` + `tva_incluse`. Le devis est saisi tel
  quel + taux + HT/TTC → `engagementTTC(d)` (`decisionLogic.js`) calcule le TTC. **Budgets &
  restant en TTC** (`computeAGBudgets`/`computeProjectBudgets`), le dépassement se contrôle sur le
  TTC (un devis HT « qui rentre » peut dépasser le budget TTC). Affiché décision + fiche projet.
  ⚠ Les 3 selects de décisions dans `supabaseDb.js` incluent désormais tva_taux/tva_incluse (sinon
  budgets faussés en prod). Décisions héritées (tva null) traitées TTC, pas de gonflement.

## Session 2026-07-23/29 — commentaires, sans vote, WhatsApp éditable, verrous

Toutes ces fonctionnalités sont **en prod** (déployées + migrations 019-021 appliquées à la main).

- **✅ Commentaires de suivi sur les décisions** (migration 019 : type `'commentaire'` dans
  `questions_reponses`). Section « Commentaires » dans le bloc de lecture, **avant les pièces
  jointes**. Distinction voulue par Pascal : **Q&A précède le vote, le commentaire vient après**
  (mise en œuvre). Un commentaire n'attend pas de réponse → **ne compte pas** comme « question sans
  réponse » au registre.
- **✅ Statut de résolution « Sans vote »** (migration 020 : `'sans_vote'` dans
  `resolutions_ag.statut`). Résolution présentée mais non soumise au vote. N'alloue aucun budget
  (comme rejetée/retirée — seule `adoptee` alloue).
- **✅ WhatsApp éditable, 3 gabarits** (`share.js` + `ShareModal`). Le message figé « relance de
  vote » devient un **textarea éditable** avec 3 gabarits : **Demande de vote**, **Mise à jour**
  (point de situation libre), **Décision enregistrée** (annonce le résultat, adoptée/rejetée). Le
  bouton « Notifier » reste visible **après** enregistrement (`isOwner || isAdmin`).
- **✅ Notifications de bureau — 2 corrections** (`useActivityNotifications.js`) : (1) ne plus
  notifier l'activité d'une décision **enregistrée** (le dernier vote avant l'enregistrement
  déclenchait une notif inutile) ; (2) **base de référence qui accumule** (on n'y retire jamais) →
  plus de notifs répétées quand `listVotes()` renvoie une fois une liste incomplète. ⚠ Le hook
  tourne dans l'onglet ouvert : **recharger l'app** (`Cmd+Shift+R`) pour prendre le nouveau code.
- **✅ Décision enregistrée = registre figé, saisie verrouillée** : les champs commentaire /
  question / réponse **disparaissent** (UI), **et** la RLS `qa_self_insert` exige désormais
  `enregistree = false` (migration 021, alignée sur `votes_self_write`). Verrou garanti UI + serveur.
- **✅ Registre enrichi (suite)** : colonne **« Dates »** fusionnée (publication + limite dessous),
  colonne **« Votes »** en détail **pour/contre/abstention/non voté** (2 lignes), badge
  **« N question(s) sans réponse »**, **chargement durci** (erreur affichée au lieu d'un écran vide
  — cause du « trésorier qui ne voyait rien » : session expirée côté client, pas un bug RLS).

## Session 2026-07-21/22 — notifications de bureau, registre enrichi, robustesse

- **✅ Notifications de bureau (président + secrétaire) — validées en réel (Mac + iPhone).**
  `src/lib/useActivityNotifications.js` (monté dans `Layout`) : tant que l'app est ouverte, un
  **sondage 30 s** compare votes et questions à une base de référence et affiche une **notification
  système** (Notifications API) sur tout **nouveau vote / nouvelle question** non écrit par soi.
  **Aucun backend** (ni service worker, ni push, ni Edge Function) → l'onglet doit rester ouvert.
  Confort d'alerte, **pas** une preuve (l'e-mail/PV restent la trace). Activation via un bouton dans
  **Paramètres** (`requestPermission()` exige un geste utilisateur), drapeau localStorage
  `activity_notifs`. Ne charge rien tant que désactivé. Si un jour on veut de l'instantané →
  bascule possible en **Supabase Realtime**.
- **✅ Registre enrichi** (`RegistreCS.jsx`) :
  - **Chargement durci** : les lectures critiques sont dans un `try/catch` qui **affiche l'erreur +
    bouton Réessayer** au lieu d'un écran vide silencieux (un seul `Promise.all` qui rejetait vidait
    toute la page — c'était le piège derrière « le trésorier ne voit rien », en fait une **session
    expirée côté client** ; la lecture ne dépend pas de l'identité, `read_auth`).
  - Colonne **« Dates »** fusionnée (publication + limite en dessous, « dépassée » en rouge).
  - Colonne **« Votes »** : détail **pour / contre / abstention / non voté** (2 lignes), dénominateur
    = quorum art. 15 (composition figée si enregistrée, sinon actifs à la publication).
  - Badge **« N question(s) sans réponse »** par décision.
  - Nouvelles méthodes repo **`listQA()`** et `listVotes()` étendu (`vote`, `auteur_id`) — mock +
    supabase, `read_auth`. Chargements votes/Q-R en `.catch(() => [])` (secondaires).
- **Rappel** : le staging tourne la branche `staging`, **sans** ces correctifs (partis sur `main`).
  Il traîne aussi des **données de recette** (décision staging 2026-001) → nettoyer via
  `nettoyage.sql` + `seed_staging.sql`.

## Session 2026-07-20 — staging, tests RBAC sur vraie RLS, correctifs UI

- **✅ Staging opérationnel** : projet Supabase staging + 5 comptes Auth (president/tresorier/
  secretaire/membre1/membre2, `pfavre25+role@gmail.com`), variables Vercel **Preview → staging**
  (les variables prod ont été re-scopées **Production seulement**). URL :
  `cs-rives-git-staging-happy-pascal.vercel.app`. ⚠ Le staging tourne la branche **`staging`**,
  qui **ne contient pas** les correctifs UI d'aujourd'hui (partis sur `main`) — à merger si on veut
  y tester la dernière UI.
- **✅ Accès par rôle validés sur vraie RLS** (staging, pas le mock) : trésorier, secrétaire,
  membre testés dans Chrome. Écritures légitimes (vote, Q/R, validation comptes) **passent** →
  `current_membre_id()` résout bien l'identité = **migration 018 validée grandeur nature**, y
  compris pour le rôle de Marc (membre). Gating conforme : Signatures = admin/secrétaire ;
  enregistrement/suppression/gestion membres = président ; comptes = trésorier. **Non fait** :
  forcer une écriture interdite via la console pour voir le refus RLS explicite (les policies sont
  les mêmes qu'en prod, revues en code). ⚠ **Traces de recette laissées** sur la décision staging
  2026-001 (votes + Q/R de test) → nettoyer via `nettoyage.sql` + `seed_staging.sql`.
- **✅ Sauvegarde locale** : `scripts/backup.mjs` (Node, sans install) — dumpe les 11 tables en
  JSON + télécharge le bucket `documents`. Lit `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` de
  l'env. Sortie `backup/` (git-ignorée). Stopgap tant que pas de Supabase Pro.
- **✅ Correctifs UI déployés en prod** : Dashboard 2/3–1/3 + badges non repliés ; colonne
  « Quorum » retirée de la liste AG (donnée inexistante, affichait un « Non atteint » factice) ;
  `confirm()` natifs → `Modal` maison (hook `useConfirm`) ; **mobile** — menu ☰ agrandi, tableau de
  vote empilé (commentaire pleine largeur), liste membres en cartes 2 lignes.
- **Revue GUI complète** (12 écrans) : tout fonctionne, budgets cohérents, zéro erreur console.
  **Reste à traiter** : la **fiche projet en mobile** (#3 des retours, reportée).

## Session 2026-07-19 — validation en conditions réelles + corrections

- **🔴 Bug prod corrigé — casse d'email (RLS).** Un membre (Marc) pouvait lire et télécharger
  mais **ni voter ni publier en Q/R**. Cause : `membres_cs.email` = `Marc@…` (majuscule) ≠ email
  d'Auth `marc@…` (minuscule) → `current_membre_id()` (comparaison stricte) renvoyait `null` →
  toute écriture liée à l'identité rejetée par la RLS ; les lectures passaient (aucune identité
  requise). **Fix appliqué** en base : `update membres_cs set email = lower(trim(email))`. Les 4
  autres membres étaient déjà OK (audit fait). Le membre doit **se reconnecter** pour recharger
  son `membre_id`.
  - ✅ **Durcissement fait — migration `018` appliquée en prod (2026-07-19).** Appariement email
    **insensible à la casse** partout : les 4 helpers RLS (`is_admin`, `is_secretaire`,
    `is_tresorier`, `current_membre_id`) comparent en `lower()=lower()` ; `resolveUser` matche la
    forme canonique ; `createMembre`/`updateMembre` normalisent l'email ; un **trigger**
    `membres_cs_normalize_email` garantit `lower(trim())` en base quel que soit le client. **Et**
    la surface d'erreur : `DecisionDetail.jsx` enveloppe vote / retrait / commentaire / question /
    réponse dans un `try/catch` → un rejet RLS **s'affiche** au lieu de rester silencieux.
    **Validé sur staging** (création membre `Test@…` → normalisé, vote/Q-R OK) puis appliqué prod.
    ⚠ Piège rencontré : l'éditeur Supabase parse mal plusieurs fonctions `$$` — 018 utilise des
    **balises nommées uniques** (`$is_admin$`, `$current_membre$`, …).
- **✅ Champs multi-lignes auto-extensibles (déployé prod, commit `96ab1f8`).** Les saisies
  question / réponse / commentaire de vote passent de `<input>` mono-ligne à un `Textarea` qui
  épouse son contenu. `ui.jsx` : `Textarea` gagne une option **`autoGrow`** (opt-in, non cassante ;
  redimensionne sur `onInput` pour les champs non contrôlés + effet sur `value` pour les contrôlés)
  et rend le `<textarea>` nu quand il n'y a pas de `label` (enfant flex direct).
- **Staging préparé** : `supabase/seed_staging.sql` (données de recette), branche `staging`
  poussée (déclenche un déploiement Preview Vercel), procédure complète dans `docs/STAGING_UAT.md`.
  **Reste côté Pascal** (manuel) : créer le projet Supabase staging, ses 5 comptes Auth, et
  scoper les variables Vercel **Preview → staging** (⚠ vérifier que les variables prod sont bien
  `Production` seulement, sinon le staging taperait dans la prod).

## Backlog — à reprendre ensuite

- **⛔ CONNEXION DES COLOTIS — GELÉ, ne rien coder** (décision Pascal 2026-08-25). Reprise **quand
  le mécanisme d'onboarding automatique sera clair** ; la spéc sera alors **réécrite**. Voir
  **`docs/SPEC_ONBOARDING_COLOTIS.md`**, rédigée à la demande de Pascal *avant* tout code. Le
  besoin « membre de l'équipe projet ouvert aux colotis » n'ajoute pas un rôle : il ouvre l'app à
  des non-membres, donc oblige à **refermer et réécrire `read_auth` sur toutes les tables** (un
  compte coloti créé aujourd'hui lirait tout le registre, votes nominatifs compris).
  - **Deux préalables qui ne coûtent rien et débloquent tout** : (0) obtenir de **Foncia le rôle
    des colotis** — sans liste exploitable, aucun mécanisme d'inscription ne tient ; (0 bis)
    **trancher en CS** ce que voient un coloti et un membre d'équipe (§5.1 de la spéc) : les votes
    nominatifs ? les décisions rattachées au projet ?
  - **Ne pas verser les colotis dans `membres_cs`** : ils compteraient dans le quorum et parmi les
    signataires de l'art. 15 (`activeMembersAt`). Modèle recommandé : table `colotis`, et
    `membres_cs` la référence — tout membre du CS est aussi un coloti, et le redevient en fin de
    mandat (renouvellement du 15/09).
  - Dépend aussi du **domaine vérifié** (invitations par e-mail) et d'un **staging remis à niveau**
    — le mock ne prouve rien sur la RLS.
  - ⚠ Le rôle visé est **étroit** (un projet, en lecture, sans droit de délibérer). Ce n'est pas son
    étendue qui coûte, c'est que l'app **n'a aucun moyen de restreindre qui que ce soit** aujourd'hui.
    Un rôle « très limité » ne peut pas être limité tant que la plomberie n'existe pas.
- **⚠ STATUTS EN COURS DE RÉVISION — AG du 15/09/2026.** L'AG vote un **projet de nouveaux
  statuts** ; **Me Garnier en adaptera la rédaction finale pour que le mode de fonctionnement de
  l'application soit conforme**. C'est ce qui ferme le point resté ouvert depuis la spec (l'art. 15
  est rédigé pour des réunions, un vote dans l'app est une consultation écrite) — et par le bon
  bout : on ne tord pas l'outil pour entrer dans un texte, on écrit le texte qui décrit l'outil.
  - **À FOURNIR à Me Garnier** : la description exacte de ce que fait l'app. Sans elle, la
    rédaction se fera sur une idée approximative et l'app sera non conforme sur un détail. Les
    points qui doivent y figurer, tous vérifiables dans `decisionLogic.js` : consultation écrite
    asynchrone ; **vote self-only**, aucune représentation ; adoption à la majorité des membres
    AYANT VOTÉ, **abstention au dénominateur** ; voix prépondérante du président en cas de partage ;
    **quorum interne > 50 %** (l'art. 15 actuel n'en impose aucun) ; **garde d'engagement**
    (trésorier OU président doit voter pour) ; l'**acte** = enregistrement par le président, qui
    fige composition et vote ; signature par tous les membres ayant pris part, y compris « contre ».
  - **⚠ Deux de ces règles sont des choix INTERNES plus stricts que l'art. 15** (quorum, garde
    d'engagement). Les inscrire dans les statuts les rend statutaires — donc bien plus lourdes à
    assouplir plus tard. À arbitrer avant la rédaction finale, pas après.
  - **Après l'AG** : relire `CLAUDE.md` §Statuts en cours de révision et §ARTICLE 15, et les mettre
    à jour avec le texte réellement adopté. Tant qu'il n'est pas connu, **l'art. 15 actuel reste la
    règle en vigueur** — ne rien anticiper d'une rédaction qu'on n'a pas lue.

- **Budget de fonctionnement à soumettre à l'AG** (arbitrage CS 2026-07-20). Le CS demande à l'AG
  une **enveloppe annuelle de 720 €/an** (Supabase 22 + signature 9 + domaine 1 + Claude 18 =
  **50 €/mois ≈ 600 €**, marge incluse) pour faire passer la **maquette en registre de production**
  (sauvegardes, signature réelle) **et** transférer les comptes/abonnements à l'ASL. **Majorité
  simple**, **sans remboursement** (rien n'a été avancé au-delà des offres gratuites). Claude est
  assumé comme coût de **maintenance transférable** (le successeur en aura besoin), pas un abonnement
  perso. Textes de la **décision CS** (sans cible, montant 0 — elle ne fait que saisir l'AG) et de
  la **résolution AG** (`a_voter`, 720 €) rédigés en session, à saisir dans l'app. Voir
  `TRANSFERT_ASL.md`.
- **Terminer le staging** (`docs/STAGING_UAT.md`) : côté Pascal, il reste à créer le projet
  Supabase staging, ses 5 comptes Auth, et scoper les variables Vercel **Preview → staging**.
  _(Le durcissement casse-insensible + surface d'erreur Q/R/vote — migration `018` — est **fait**
  et **déployé en prod** : voir la session 2026-07-19 ci-dessus.)_
- **Guide de démarrage, suite** : créer/gérer une AG, résolutions, projets, budgets, signature,
  espace président. Même format (Markdown + Word généré par script).
- **Traiter les retours** des collègues.
- **Signature Youtrust réelle** : encore un *mock*. Décision : plan payant **One 9 €/mois retenu**
  (désormais intégré au budget **720 €/an** soumis à l'AG — voir la ligne budget en tête de
  backlog) ; l'API a été écartée (trop chère). Reste à brancher le provider réel.
- **Supabase Pro + transfert à l'identité ASL** (`TRANSFERT_ASL.md`) : le **seul vrai risque
  restant** — tout est sur l'identité personnelle de Pascal, plan gratuit sans sauvegarde.
  Organisationnel, pas technique, mais important.
- **Notifications automatiques par email — À FAIRE APRÈS L'AG** (arbitrage Pascal 2026-07-20).
  Choix retenu : **email automatique** sur 4 déclencheurs, **+ conserver le bouton manuel
  « Prévenir le CS »** (`wa.me`, `share.js`) pour poster dans le **groupe** WhatsApp. Déclencheurs :
  (1) nouvelle décision à voter, (2) réponse à un fil Q/R où j'ai posté, (3) décision enregistrée,
  (4) lot de signature qui m'est adressé.
  - **Pourquoi email, pas WhatsApp-API** : l'API WhatsApp (officielle ou Twilio) n'écrit qu'en
    **1-à-1 vers un numéro, jamais dans un groupe** → elle perd l'intérêt du groupe CS. L'email est
    **auditable** (ce qui compte pour un registre légal), réutilise `membres_cs.email` (pas besoin
    de re-stocker les téléphones supprimés en **migration 004**), et évite la validation de
    templates Meta. Le bouton `wa.me` manuel garde, lui, l'accès au **groupe**.
  - **Bloqueurs (donc strictement post-budget)** : (a) **domaine vérifié** requis, financé par la
    décision AG, pas encore acheté ; (b) réintroduit une **Edge Function** Supabase (le projet n'en
    a AUCUNE — choix assumé) pour tenir le secret d'envoi côté serveur (le token ne peut pas vivre
    dans le client). Envoi via **Resend** (domaine vérifié) ou SMTP. C'est une **décision d'archi**
    à acter avant de coder.
  - **Rappel `CLAUDE.md`** : la notif manuelle est un choix documenté (« ne pas réintroduire d'envoi
    automatique sans demande explicite »). **Cette entrée EST la demande explicite** qui lève le
    garde-fou — mais uniquement pour l'**email**, et **après l'AG**.

## Repères techniques pour reprendre

- **Dépôt** : `github.com/happypascal/CS_Rives`. `main` → Vercel **Production**, toute autre
  branche (dont `staging`) → **Preview**. Déploiement automatique au push.
- **Bases Supabase** : prod `aitqnonioyhurbystfnk` (Paris) ; staging = 2ᵉ projet à créer.
- **Prochaine migration SQL libre** : `046` (001-029 et 031-042 appliquées en **prod**). Le
  numéro **030 n'existe pas** : il avait été attribué à la suspension par bouton, écartée avant
  livraison. Récentes : 022 (heures d'AG), 023 (cycle de statut d'AG + quorum/m²), 024 (TVA sur
  décisions), 025 (PJ sur résolutions), 026 (brouillon / soumission planifiée + pg_cron).
  ⚠ Le **staging** est **en pause** (inactivité, plan gratuit) et n'a que jusqu'à ~017 : à réactiver
  + remettre à niveau (rejouer `schema.sql` ou 018→025) avant tout test.
- **Sauvegarde prod = MANUELLE et non planifiée** : `scripts/backup.mjs` ne tourne que si on le
  lance à la main (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` en env).
  ⚠ **Corrigé le 2026-08-27** : sa liste de tables était codée en dur et avait **dérivé** — figée à
  11 tables, elle en ignorait **six** ajoutées depuis, dont `lots` et `proprietaires`. Une
  sauvegarde lancée la veille aurait laissé le registre des propriétaires de côté **en silence**.
  Les tables sont désormais **découvertes** à chaque exécution via la description OpenAPI de
  PostgREST (`GET /rest/v1/`) : la seule source qui ne peut pas dériver, puisqu'elle vient de la
  base. La liste en dur ne sert plus que de filet, et toute table attendue mais non découverte est
  signalée. ⚠ **La sauvegarde contient désormais des DONNÉES PERSONNELLES** (registre des
  propriétaires) : machine de confiance, chiffrée, transmise à personne — c'est le « fichier
  exporté » que la mention RGPD vise expressément. **Donc pas de sauvegarde
  auto aujourd'hui.** Décidé de **ne pas** faire de keep-alive/cron (pansement) — le vrai correctif
  reste **Supabase Pro** (backups auto + jamais de pause). Le mail Supabase du 27/07 (pause du
  staging) rappelle que la prod pourrait aussi se mettre en pause sur une longue période creuse.
- **Tester sans risque** : le **staging** (vraie RLS, données isolées) — cf. `docs/STAGING_UAT.md`.
  Le mode démo (mock, sans variables Supabase) ne teste **pas** les droits.
- **Rappel workflow** : une migration s'applique **à la main** dans le SQL Editor **avant** de
  pousser le code qui en dépend. `npm run lint` avant de pousser.
