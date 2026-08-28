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
- **Prochaine migration SQL libre** : `043` (001-029 et 031-042 appliquées en **prod**). Le
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
