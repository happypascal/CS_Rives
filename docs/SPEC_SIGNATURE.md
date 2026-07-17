# Spécification — signature du registre

> État au 2026-07-17 : **spec, rien de codé**. Le module de signature est un **mock** :
> `signatureProvider.js` simule un envoi sans contacter personne, et le stub Yousign lève une
> exception s'il est activé. Le bouton « Simuler signé (démo) » existe.

## 1. La règle, et d'où elle vient

**Aucune loi n'impose de signer.** L'ordonnance 2004-632 art. 7 renvoie tout aux statuts ; le
décret 2006-504 est muet sur les PV et les signatures. Ce sont **les statuts** qui l'imposent —
`statuts_ASL_v5_Favre.doc`, **article 15** :

> « Les délibérations sont inscrites […] sur un registre spécial […] et **signé par tous les
> membres présents à la délibération**. »

Trois conséquences, toutes contre-intuitives :

- **Signataire = a voté**, y compris **Contre**. (La spec v2 §4.5 disait « Pour ou Abstention » :
  non conforme, corrigé dans le code, mais **le texte de la modale de RegistreCS ~ligne 276
  l'affirme encore** — à corriger.)
- **Un absent ne signe pas.** Un non-vote est une absence, pas une abstention.
- La signature vaut **par délibération**, pas par lot.

**Réserve à faire lever par le notaire** : l'art. 15 fait signer les membres « présents à la
délibération ». Ici personne n'est jamais réuni — chacun vote depuis son téléphone, à distance
et à des moments différents. Interpréter « présent » comme « a participé au vote » est une
lecture (la nôtre, vraisemblablement conforme à l'esprit du texte), pas une certitude. Ne bloque
rien, l'app est déjà bâtie ainsi ; à confirmer d'une phrase au notaire lors de la validation des
statuts : « nos délibérations et signatures se font par vote électronique à distance, conforme à
l'art. 15 ? ».

## 2. Le bug à corriger

`RegistreCS.sendForSignature` fait aujourd'hui l'**union** des votants de toutes les décisions
du lot dans un seul ensemble d'emails. Si Nicolas n'a pas voté la décision 13, il reçoit quand
même à signer un document qui la contient. Sa signature apparaîtrait au registre sur une
délibération à laquelle il n'était pas présent — exactement ce que l'art. 15 interdit.

Invisible tant que les 5 votent tout. Ne se déclenche que le jour où ça compte.

## 3. Le choix de conception (arbitrage 2026-07-17)

**L'écran ne propose que des groupes homogènes.** Un groupe = un ensemble de décisions ayant
**exactement le même ensemble de votants**.

Écarté : pré-sélectionner les décisions au même motif quand on en choisit une. L'utilisateur
pourrait décocher et reconstruire un lot non conforme → il faudrait quand même valider,
refuser, et porter un état d'erreur dans la modale (qui n'en a aucun aujourd'hui). Deux fois
le travail pour un résultat moins sûr.

Le principe : **rendre l'état invalide impossible à exprimer** plutôt que le détecter. La règle
de l'art. 15 devient la forme de l'écran, pas un message d'erreur.

Le tableau du registre **ne change pas** : il reste chronologique et légal. Le motif de votants
est une préoccupation de signature, pas de registre.

## 4. Écran « À faire signer »

Section propre dans `RegistreCS`, au-dessus des « Lots de signature » existants. Président
seul, desktop seul (`canManage`).

**Éligibilité d'une décision** — inchangée, c'est le `selectable()` actuel :
`enregistree` ET `statut === 'adoptee'` ET pas déjà dans un lot `signe`.

**Groupement** : clé = `[...new Set(d.votes.map(v => v.membre_id))].sort().join('|')`.

Par groupe, afficher :
- les **signataires** nommés (ce sont eux qui recevront le document) ;
- les décisions du groupe (numéro + objet court) ;
- un bouton **« Envoyer pour signature »**.

Un groupe à un seul membre est légitime : il n'y a pas de seuil.

**Pas de cases à cocher.** On envoie un groupe entier, ou rien. Si le président veut n'en
envoyer qu'une partie, il attend — le registre n'est pas pressé, et un lot partiel n'apporte
rien qu'un lot complet n'apporte.

## 5. Le quota, qui n'est pas un détail d'affichage

**Une demande Youtrust = une enveloppe = un groupe.** N documents × N signataires comptent
pour **1** ; chaque signataire signe une seule fois pour toute la demande.

- Plan **Free (0 €)** : **2 demandes/mois**, 50 documents, **5 signataires max par demande**.
- Plan **One (9 €/mois)** : 10 demandes, 100 signataires.
- API : **écartée** (1 248 €/an — absurde pour ~40-80 signatures/an).

Donc **le nombre de groupes est le budget**, pas de la décoration. L'écran doit afficher le
nombre de demandes que l'envoi consommera, et **prévenir au-delà de 2 dans le mois** sur le
plan Free.

⚠ **Le CS est à 5 membres, le plafond Free est à 5 signataires** : pile au plafond, zéro marge.
L'art. 14 prévoit « trois à cinq membres » — un 6e membre est statutairement impossible, mais
un groupe de 5 ne tolère aucun élargissement.

## 6. Mode retenu : MANUEL

L'app prépare, le président exécute. Aucune intégration, aucune clé, aucun coût.

1. L'app fournit le **PDF du groupe** et la **liste des emails des signataires**, à copier
   dans Youtrust.
2. Le président marque le lot **« envoyé »**, puis **« signé »** avec dépôt du PDF signé.

Cohérent avec le bouton « Prévenir le CS » : pour 4-5 personnes, le manuel assisté vaut mieux
que toute infrastructure automatique. `signature_batches` existe déjà et convient tel quel
(`decision_ids[]`, `signataires[]`, `statut`).

## 7. Ce qu'il faut ajouter au code

- **`listVotes()` dans les DEUX backends** (`mockDb.js` et `supabaseDb.js`, signatures
  identiques). Le registre ne charge aujourd'hui que `listMyVotes(membre_id)` : grouper par
  motif exige tous les votes. Léger — seuls `decision_id` et `membre_id` sont utiles.
- Le groupement et l'écran dans `RegistreCS.jsx` ; retrait des cases à cocher et de
  `sendForSignature` dans sa forme actuelle.
- Correction du texte périmé de la modale (« Pour ou Abstention »).
- `signataires[]` reste **figé** dans le lot à l'envoi : la composition du CS peut changer, le
  registre doit rester fidèle à ce qui a été signé.

## 8. Non couvert, assumé

- **La représentation** (art. 15, « ou représentés ») : **écartée par conception**, pas
  seulement non implémentée (arbitrage Pascal 2026-07-17). Le vote est électronique et
  individuel — chacun vote seul depuis son téléphone, ou ne vote pas. Il n'existe aucun moment
  où un membre pourrait porter la voix d'un autre : voté ou pas voté, rien entre les deux. Ne
  pas réintroduire « ou représentés » sans un changement de modèle de vote décidé en amont.
- Le renommage **Yousign → Youtrust** : le code garde le nom mort
  (`signatureProvider.js`, colonne `yousign_request_id`). Conservé sciemment — un renommage
  cosmétique ne vaut pas une migration.
