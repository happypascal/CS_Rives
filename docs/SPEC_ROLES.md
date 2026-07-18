# Spécification — rôles du bureau et conséquences

> État au 2026-07-18 : **spec**. Le point 1 (projet owned par son créateur) est implémenté
> séparément ; les points 2 à 5 attendent la migration des rôles (transversale, coordonnée).

## Fondement statutaire

**Article 14** : le CS (3 à 5 membres) désigne un **président** ; le président désigne
*éventuellement*, parmi les membres, un **trésorier** et un **secrétaire**. Donc :
- Les trois rôles existent statutairement. Trésorier et secrétaire sont **optionnels**.
- **C'est le président qui attribue les rôles** (dans la page Membres, président seul).
- Un seul de chaque. Les autres membres sont de simples `membre`.

**Article 15** (inchangé) : le registre est « signé par tous les membres présents à la
délibération ». Aucune obligation statutaire de co-signature du trésorier — la règle du
point 3 est une exigence **interne** que Pascal ajoute, à concilier avec l'art. 15.

**Comptes** : c'est l'**AG ordinaire** qui approuve les comptes et donne le quitus (art. 13).
Le syndic les prépare, le CS les contrôle 30 jours avant. La « validation par le trésorier »
(point 4) est donc un **contrôle interne en amont**, pas l'approbation légale.

## Rôles et capacités

`membres_cs.role` passe de `('president','membre')` à
`('president','tresorier','secretaire','membre')`.

| Action | président | secrétaire | trésorier | membre |
|---|:--:|:--:|:--:|:--:|
| Créer / modifier SA décision (owner) | ✅ | ✅ | ✅ | ✅ |
| **Enregistrer** une décision (l'acte) | ✅ | — | — | — |
| Créer / modifier SON projet (owner) | ✅ | ✅ | ✅ | ✅ |
| Supprimer un projet (non engagé) | ✅ | — | — | — |
| Créer / modifier une AG | ✅ | ✅ | — | — |
| **Valider les comptes** d'une AGO | ✅¹ | — | ✅ | — |
| **Faire signer** (gérer les signatures) | ✅ | ✅ | — | — |
| Attribuer les rôles | ✅ | — | — | — |
| Voter (self-only) | ✅ | ✅ | ✅ | ✅ |

¹ Le trésorier est le responsable désigné ; le président peut valider aussi (autorité
supérieure). À confirmer si Pascal veut le **restreindre au trésorier seul**.

`is_admin()` reste = `président`. On ajoute `is_secretaire()` et `is_tresorier()`
(même forme : email du JWT = membre actif portant le rôle). Les droits « faire signer » et
« éditer une AG » deviennent `is_admin() OR is_secretaire()`.

## Les cinq features

### 1. Projet owned par son créateur — INDÉPENDANT, implémenté à part
Tout membre actif crée un projet et en devient **owner** (`projets.created_by`). L'owner seul
le modifie ; les autres membres ne le modifient pas ; **personne ne le supprime sauf le
président** (et seulement s'il n'est pas engagé — garde existante `projets_delete_guard`).
Calque exact du modèle des décisions (`decisions_owner_*`). `created_by` distinct de
`chef_projet_id` (rôle fonctionnel, pas de permission).

### 2. Secrétaire — peut faire signer
Le secrétaire accède à la page **Signatures** (aujourd'hui président seul) et peut créer les
demandes. `Signatures` : garde `isAdmin` → `isAdmin || isSecretaire`. Entrée de menu de même.
Il peut aussi **créer et modifier une AG** (droit d'écriture AG étendu).

### 3. Trésorier — co-signature des décisions financières, par PARTICIPATION OBLIGATOIRE
Arbitrage Pascal : une décision **financière** n'est **enregistrable** que si le **trésorier
ET le président ont voté** (peu importe le sens — présence au sens de l'art. 15). Ils sont
alors naturellement signataires : **aucun conflit avec l'art. 15**, c'est une condition de
validité ajoutée à l'enregistrement, pas une signature forcée d'un absent.
- **« Financière »** = `montant_engage != null` (engagement d'argent). ⚠ À confirmer : une
  décision qui suspend/clôture un projet (`projet_action`) sans montant compte-t-elle ?
- Le bouton « Enregistrer » se désactive, avec le motif, tant que le président ou le trésorier
  n'a pas voté une décision financière. S'ajoute au quorum + adoption existants.
- **Si aucun trésorier n'est désigné**, la règle est inerte (seul le président). Documenté.
- Porté dans `decisionLogic` (pur, testable) : `enregistrable(decision, votes, composition)`.

### 4. Trésorier — validation des comptes d'une AGO
Sur une AG de type **AGO**, un bouton **« Comptes validés »** réservé au trésorier (et au
président) horodate `comptes_valides_le` + `comptes_valides_par`. Simple attestation — on ne
gère pas les documents comptables eux-mêmes (le syndic les tient). Le secrétaire, qui peut
créer/éditer l'AG, **n'a pas** ce bouton.

### 5. Secrétaire — édition des AG (corollaire du 2/4)
Le droit d'écriture sur `assemblees_generales` passe de président seul à
`is_admin() OR is_secretaire()`. La validation des comptes reste `is_admin() OR is_tresorier()`.

## Séquence de migrations (chacune appliquée à la main par Pascal)

Chaque migration est **inerte tant que le code correspondant n'est pas déployé** — sauf
mention. Coordination code↔SQL comme d'habitude (leçon 011).

1. **`013_projets_owner.sql`** — `projets.created_by` + policies owner. Inerte (colonne
   nullable). → point 1.
2. **`014_roles_bureau.sql`** — élargit le `check` de `membres_cs.role` à
   `tresorier`/`secretaire` ; ajoute `is_secretaire()`, `is_tresorier()`. Inerte (personne ne
   porte encore ces rôles). Fondation des points 2-5.
3. **`015_ag_secretaire_comptes.sql`** — droit d'écriture AG au secrétaire ;
   `assemblees_generales.comptes_valides_le` + `comptes_valides_par` + policy trésorier.
   → points 4 et 5.
4. Code : Signatures ouvert au secrétaire (point 2) ; garde d'enregistrement financier
   (point 3, `decisionLogic`) ; bouton comptes (point 4) ; édition AG secrétaire (point 5) ;
   attribution des rôles dans Membres.

## Points à confirmer par Pascal
- 3 : `projet_action` sans montant = décision financière ou non ?
- 4/¹ : la validation des comptes est-elle réservée au **trésorier seul**, ou président aussi ?
- Un membre peut-il cumuler deux rôles (président **et** trésorier) ? Art. 14 les distingue ;
  je suppose **exclusif** (un rôle par membre).
