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
| **Approuver les comptes** d'une AGO | ✅ (1 des 2) | — | ✅ (1 des 2) | — |
| **Faire signer** (gérer les signatures) | ✅ | ✅ | — | — |
| Attribuer les rôles | ✅ | — | — | — |
| Voter (self-only) | ✅ | ✅ | ✅ | ✅ |

Les comptes d'une AGO ne sont **validés que lorsque le trésorier ET le président ont approuvé**
(deux approbations distinctes, cf. feature 4).

`is_admin()` reste = `président`. On ajoute `is_secretaire()` et `is_tresorier()`
(même forme : email du JWT = membre actif portant le rôle). Les droits « faire signer » et
« éditer une AG » deviennent `is_admin() OR is_secretaire()`.

## Les cinq features

### 1. Le chef de projet modifie son projet — INDÉPENDANT, implémenté (migration 013)
Tout membre actif crée un projet **en tant que chef de projet** (`chef_projet_id = lui`) et le
modifie à ce titre. Les autres membres ne le modifient pas ; **seul le président supprime**
(projet non engagé — garde `projets_delete_guard`).

⚠ La permission s'ancre sur **`chef_projet_id`**, PAS sur un `created_by` séparé (arbitrage
Pascal 2026-07-18) : quand le **président** crée un projet et **désigne un membre comme chef**,
ce membre doit pouvoir le modifier — un `created_by` (= le président créateur) le lui aurait
interdit. Le chef est donc à la fois rôle fonctionnel et ancre de permission. Aucune colonne
ajoutée.

Le flux **président inchangé** (sa demande explicite) : bouton « Nouveau projet », il assigne
le chef, et une résolution d'AG est rattachée ensuite pour financer. Un **membre** crée un
projet autonome (budget 0) dont il est le chef ; le financement est rattaché plus tard depuis
l'AG. Un membre ne peut pas ouvrir un projet depuis une résolution (le rattachement écrit sur
`resolutions_ag`, réservé à l'admin) — d'où la création autonome côté membre.

### 2. Secrétaire — peut faire signer
Le secrétaire accède à la page **Signatures** (aujourd'hui président seul) et peut créer les
demandes. `Signatures` : garde `isAdmin` → `isAdmin || isSecretaire`. Entrée de menu de même.
Il peut aussi **créer et modifier une AG** (droit d'écriture AG étendu).

### 3. Trésorier — co-signature des décisions financières, par PARTICIPATION OBLIGATOIRE
Arbitrage Pascal : une décision **financière** n'est **enregistrable** que si le **trésorier
ET le président ont voté** (peu importe le sens — présence au sens de l'art. 15). Ils sont
alors naturellement signataires : **aucun conflit avec l'art. 15**, c'est une condition de
validité ajoutée à l'enregistrement, pas une signature forcée d'un absent.
- **« Financière » = `montant_engage != null`, un point** (arbitrage Pascal 2026-07-18 : « le
  trésorier ne s'occupe que de l'argent »). Une décision qui suspend/clôture un projet
  (`projet_action`) **sans montant n'est PAS financière** → pas de vote obligatoire du trésorier.
- Le bouton « Enregistrer » se désactive, avec le motif, tant que le président ou le trésorier
  n'a pas voté une décision financière. S'ajoute au quorum + adoption existants.
- **Si aucun trésorier n'est désigné**, la règle est inerte (seul le président). Documenté.
- Porté dans `decisionLogic` (pur, testable) : `enregistrable(decision, votes, composition)`.

### 4. Validation des comptes d'une AGO — CO-APPROBATION trésorier + président
Sur une AG de type **AGO**, les comptes de l'exercice sont **validés quand le trésorier ET le
président ont approuvé** (arbitrage Pascal 2026-07-18 : « les 2 doivent avoir approuvé
obligatoirement »). Deux approbations distinctes, chacune horodatée :
`comptes_approuve_tresorier_le` + `comptes_approuve_president_le` (+ qui). Les comptes sont
« validés » seulement quand les deux sont posées. Simple attestation — on ne gère pas les
documents comptables (le syndic les tient). Le **secrétaire** peut créer/éditer l'AG mais **n'a
aucun** de ces deux boutons.

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

## Tranché (arbitrages Pascal 2026-07-18)
- 3 : financière = `montant_engage != null` **seulement** ; `projet_action` sans montant = non.
- 4 : comptes validés = **trésorier ET président** ont approuvé (co-approbation).
- Rôles **exclusifs** : un seul rôle par membre (pas de cumul président/trésorier).
- Point 1 : ancre de permission = `chef_projet_id`, pas de `created_by`. Flux président inchangé.
