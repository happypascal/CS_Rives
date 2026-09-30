# Conventions d'interface — Registre CS · ASL Lotissement de Rives

> **Ce document décrit ce que l'application FAIT**, pas ce qu'elle devrait faire. Chaque règle a été
> relevée dans le code ou naît d'un défaut constaté en usage. Une règle qu'on n'applique pas n'a
> rien à faire ici : mieux vaut un manuel court et vrai qu'un manuel complet et démenti par
> l'écran.
>
> ⚠ **Ce n'est pas le manuel de l'utilisateur.** Celui-là est dans l'application
> (`src/lib/aideLogic.js` + écrans *Aide* et *Comment faire*), versionné avec le code et organisé
> par entrée de menu. Ici, on s'adresse à qui **écrit** l'interface.

---

## 0. Le principe qui commande tous les autres

Cette application est un **registre légal**. Une erreur d'affichage n'y produit pas une gêne, elle
produit une croyance fausse sur une décision qui engage de l'argent et des personnes.

D'où trois règles qui priment sur l'esthétique :

1. **Une absence doit se voir.** Un champ vide, une liste vide, une donnée inconnue se DISENT. Le
   pire mode de panne de ce produit, ce n'est pas l'erreur affichée, c'est **l'écran amputé qui a
   l'air normal**.
2. **On signale, on ne corrige pas en silence.** Une incohérence s'affiche ; l'application ne
   tranche pas à la place de celui qui sait.
3. **On ne décrit que ce qui est vrai.** Un libellé qui promet un bouton inexistant est pire que
   pas de libellé.

---

## 1. Langue et typographie

- **Interface en français**, toujours.
- **Apostrophes typographiques** `’`, jamais `'`. **Tirets cadratins** `—` pour les incises.
- Ton **sobre, professionnel, document juridique**. Pas d'exclamation, pas de familiarité.
- Les montants en `fr-FR` (`eur`, `num` de `ui.jsx`).
  ⚠ **Leur séparateur de milliers est une espace insécable** : un montant ne se coupe jamais en
  deux lignes. Sur une carte étroite, il déborde. D'où `text-lg sm:text-2xl` sur les chiffres des
  cartes de synthèse, et non `text-2xl` sec.

---

## 2. L'en-tête de page

Tout écran s'ouvre par `<PageHeader title subtitle actions>` (exporté, curieusement, par
`ProtectedRoute.jsx`).

**Les actions d'en-tête sont des BOUTONS, jamais des liens soulignés.**

```jsx
actions={(
  <div className="flex flex-wrap items-center gap-2">
    <Link to="/ag/archives/x"><Button variant="secondary">← 2007</Button></Link>
    <Link to="/ag/archives"><Button variant="secondary">Retour aux archives</Button></Link>
  </div>
)}
```

⚠ **`ghost` EST BANNI DES EN-TÊTES DE PAGE.** C'est la règle la plus facile à enfreindre sans s'en
rendre compte : `ghost` n'a **ni bordure ni fond** (`text-navy-700 hover:bg-navy-50`), donc un
bouton `ghost` **ressemble à du texte**. Remplacer un lien souligné par un `ghost` ne change rien à
l'œil — c'est l'erreur commise puis corrigée le 2026-09-30, sur onze boutons de huit écrans. En
en-tête de page, une action est `secondary`, `danger`, ou **l'unique** action de création en
`primary`.

⚠ Constaté le même jour : trois écrans servaient encore des **liens soulignés** en en-tête (les deux
écrans d'archives, et *Envois aux colotis*). Deux raisons de ne pas recommencer — la même action y
avait l'air d'une **note de bas de page**, et une zone cliquable de la hauteur d'une ligne de texte
**se rate au doigt** là où un bouton fait 36 px.

⚠ `PageHeader` passe à la ligne sous 640 px (`sm:flex-row`) : plusieurs boutons n'y débordent pas.

**Comment le vérifier** — aucun `variant="ghost"` ne doit se trouver entre `<PageHeader` et le
`/>` qui le ferme.

---

## 3. Les boutons

`<Button variant size>` — les variantes réellement employées, et ce qu'elles veulent dire :

| Variante | Emploi | Fréquence |
|---|---|---|
| *(défaut)* `primary` | **L'action de création** de l'écran : « + Nouvelle AG », « Créer un projet ». **Une seule par écran.** | rare, voulu |
| `secondary` | Action utile mais non principale : naviguer, ouvrir, exporter, replier. | 49 |
| `ghost` | **Dans une carte seulement** : « Annuler » d'un formulaire, « Tout voir » d'un `CardHeader`. ⚠ **Jamais en en-tête de page** : sans bordure ni fond, il n'y a pas l'air d'un bouton. | 11 |
| `danger` | Supprimer, annuler une délibération. Jamais pour autre chose. | 9 |
| `subtle` | Défini, non employé. Ne pas l'introduire sans raison. | 0 |

**La règle de lecture** : en en-tête, **tout est visible** — `secondary` par défaut, `danger` pour
ce qui détruit, `primary` pour l'unique action de création. Ce sont les **mots** qui distinguent
« ← 2007 » de « Retour aux archives », pas la discrétion du bouton. À l'intérieur d'une carte, la
hiérarchie peut redescendre d'un cran jusqu'à `ghost`, parce que le cadre de la carte fournit déjà
le contraste.

**Tailles** : `sm` dans un en-tête de carte (`CardHeader actions`), `md` partout ailleurs.

---

## 4. Où les liens soulignés restent légitimes

**À l'intérieur des cartes**, pour une **bascule** ou un dépliage : « Afficher la transcription »,
« Voir ce qui manque », « Afficher les N autres points de l'ordre du jour ». C'est la convention de
dix écrans, et elle tient : ces commandes appartiennent au contenu, pas au cadre.

```jsx
<button type="button" onClick={…} className="text-sm text-navy-600 underline">…</button>
```

⚠ **Un `<button type="button">`, jamais un `<a>` sans destination.** Un lien qui ne mène nulle part
casse le clic milieu, le menu contextuel et les lecteurs d'écran.

⚠ **Le libellé dit ce qu'il fait, et combien** : « Afficher les 10 autres points » et non
« Voir plus ». Et il **ne nomme pas ce qu'il replie** s'il ne peut pas le faire exactement :
« bureau, comptes, quitus » était vrai de la plupart des assemblées et faux de 2023.

---

## 5. États vides, chargement, résilience

- **Chargement** : `if (loading) return <Spinner />` — 21 écrans le font.
- **Rien à montrer** : `<EmptyState title hint action>`. ⚠ Le `hint` dit **pourquoi** c'est vide et
  **quoi faire**, pas « Aucun élément ».
- **Chargement secondaire** : `.catch(() => [])`. **Une requête qui échoue ne doit jamais vider
  l'écran** — 13 écrans appliquent cet idiome.
- **Erreur** : une carte rouge en haut (`<Card className="mb-4 p-4 text-sm text-red-700">`), jamais
  une alerte modale, jamais un échec muet.

⚠ **Distinguer « vide » de « pas encore rempli » de « on ne sait pas ».** Trois états, trois
phrases. L'AG 1988 n'a aucune décision *parce que son procès-verbal manque* — lui servir « pas
encore dépouillée » serait un mensonge.

---

## 6. Mobile

`useIsMobile()` (matchMedia < 768px), employé par 18 écrans.

**Mobile = consultation + vote.** La création et la gestion sont derrière `!isMobile`, et l'écran
qui les porte affiche `<DesktopOnly what="…" />`.

### Les quatre pièges constatés en usage (2026-09-21)

1. ⚠ **La garde anti-débordement d'`index.css` CACHE les pannes qu'elle ne répare pas.**
   `overflow-x: hidden` sur `html`/`body`/`#root` **coupe** ce qui dépasse, sans barre de défilement
   et sans rien qui signale qu'il manque du texte. **Un écran amputé a l'air normal.**
2. ⚠ **Un enfant de grille garde `min-width: auto`** : la piste est dimensionnée sur son contenu
   minimal (un nom de fichier, un montant insécable) et déborde. Réglé en un point —
   `:where(.grid) > * { min-width: 0 }` dans `index.css`. `:where()` annule la spécificité, donc un
   `min-w-*` explicite l'emporte toujours.
3. ⚠ **Un tableau large devient des CARTES, il ne défile pas** (`isMobile ? cartes : table`) :
   `RegistreCS`, `Membres`, `ProprietairesList`, `ProjetList`, `AGList`, `BudgetsConsolidated`,
   `CommunicationsList`. Le `overflow-x-auto` *fonctionne*, mais **rien n'indique qu'il y a quelque
   chose à droite** — et ce sont les colonnes de montants qui tombent.
4. ⚠ **Les montants `fr-FR` ne se coupent jamais** (cf. §1).

### Comment vérifier

Le navigateur piloté fige son viewport. **Charger l'application dans une iframe de 390 px** donne au
document interne son vrai viewport (media queries et `matchMedia` s'y résolvent). Mesurer
l'amputation, et **ignorer ce qui a un ancêtre en `overflow-x: auto`** — sinon tout le contenu d'un
tableau qui défile remonte en faux positif.

---

## 7. Tableaux

- ⚠ **`table-fixed` + `<colgroup>` sont nécessaires pour que `truncate` tronque.** En disposition
  automatique, le navigateur élargit la colonne jusqu'à contenir le texte : c'est le tableau entier
  qui déborde.
- ⚠ **Les largeurs se MESURENT sur les données, elles ne s'estiment pas.** Sur les archives, le
  résultat est passé de 24 à 53 caractères après une revalidation : les largeurs d'avant le
  tronquaient. Compter la longueur maximale réelle, colonne par colonne, avant de figer un `w-*`.
- ⚠ **Ne jamais tronquer la colonne pour laquelle on lit le tableau.** Sur un registre, c'est le
  RÉSULTAT. Économiser là est la pire des économies de place.
- **Une ligne par objet** : le détail va dans l'infobulle (`title`), pas sur une seconde ligne.
  Même règle que le journal de bord des projets. ⚠ Ce qui passe en infobulle n'est pas perdu : la
  base garde le texte entier.
- Ce qui doit rester large (l'objet) prend `<col />` sans largeur ; le reste porte un `w-*`.

---

## 8. Couleurs, badges, statuts

`<Badge tone>` — tons disponibles : `gray`, `green`, `red`, `amber`, `navy`, `blue`.

⚠ **La couleur d'un statut se calcule PAR PRÉFIXE, jamais par table de correspondance exacte.**
L'écran des archives en avait une, de sept entrées : la revalidation du 2026-09-30 a introduit dix
libellés nouveaux, qui y tombaient tous dans la couleur par défaut et **se lisaient donc comme des
résultats ordinaires**. Voir `tonResultat()` dans `pvArchiveLogic.js`.

⚠ **Une couleur est une affirmation.** « Déclarée adoptée (majorité de l'art. 25 non atteinte) »
**n'est pas verte** : la provision de 2016 a été déclarée adoptée avec 2 500 voix quand l'article 25
en exigeait 2 551. La peindre en adoption ordinaire répéterait l'erreur du procès-verbal. Ambre :
« regardez de plus près ».

**Le vert et le rouge sont réservés aux verdicts** — adopté, rejeté. Tout ce qui n'a pas été mis aux
voix est neutre (`slate`) ou bleu (`sky`) s'il s'agit tout de même d'une décision.

---

## 9. Formulaires

- ⚠ **`Input` enveloppe TOUJOURS son champ dans un `<label>`** : une classe `flex-1` passée à
  `Input` atterrit sur le champ, pas sur l'enfant flex. **Envelopper l'appel dans un `div`**
  porteur de la classe. `Textarea` a été corrigé de ce piège (rendu nu sans `label`), `Input` non.
- ⚠ **Les `null` de la base traversent le spread d'un formulaire.** `{ ...EMPTY, ...ligne }` n'est
  **pas** suffisant : `null` écrase la valeur vide du modèle (seul `undefined` laisse la valeur de
  gauche), et un `.trim()` plante. Normaliser **tous** les champs d'un coup (`sansNull`,
  `Membres.jsx`) — les traiter un par un est ce qui a produit le bug : deux champs traités, le
  troisième oublié.
- **Un champ facultatif reste facultatif.** Ne pas rendre un champ obligatoire « pour la propreté de
  la donnée » : cela force à inventer une information fausse dans un registre légal (le président de
  séance est inconnu à la convocation).
- **Valider côté écran ce dont le message de Postgres serait illisible** (unicité d'un numéro de
  résolution, par exemple).

---

## 10. Contenu riche (HTML)

`sujets.contenu`, `sujet_entrees.contenu`, `decisions.description` sont du **HTML**, rendus par
`dangerouslySetInnerHTML` avec la classe `.rich-text` et produits par `RichTextEditor`.

⚠ **Tout ce qui vient d'une source extérieure doit être ÉCHAPPÉ** avant d'y entrer : une esperluette
dans « haies & fossés » casse la fiche, un `<` avale la suite du texte. Même leçon que `&apos;`
entré en base depuis un `.docx` mal décodé.

⚠ **Un texte à sauts de ligne s'y écrase en un seul bloc** : produire des `<p>`.

---

## 11. Les pièges de `ui.jsx`

- ⚠ **`cx()` n'est PAS exporté.** Composer les classes conditionnelles avec un template literal, ou
  l'exporter d'abord.
- `ui.jsx` exporte des composants **et** des utilitaires (`eur`, `num`) : oxlint s'en plaint
  (`only-export-components`), c'est **assumé et connu**. Deux avertissements permanents, les seuls
  du projet.

---

## 12. Les règles hors interface qui en découlent

- ⚠ **`Layout.jsx` → `SECTIONS[].items[].visible` est RÉPLIQUÉ dans `aideLogic.js`**
  (`visiblePar`). **Modifier l'un oblige à modifier l'autre** : le manuel ne doit jamais décrire un
  écran que le lecteur ne voit pas.
- ⚠ **Une action ajoutée à un écran doit être ajoutée au manuel.** Une action qui existe sans être
  décrite laisse le lecteur dans l'ignorance, exactement comme une action décrite qui n'existe pas.
- **On ne cache jamais un écran qu'on peut lire** : ce sont les **boutons d'écriture** qu'on retire,
  pas l'écran, et le manuel porte alors une `noteAcces` rédigée.
- **Pas de liste grisée d'actions interdites** : une colonne de titres barrés encombre sans rien
  expliquer.

---

## 13. Accès aux données, depuis un écran

- Les pages importent `{ repo }` depuis `lib/api` et **ne touchent jamais un backend directement**.
- Toute méthode nouvelle s'ajoute **aux deux** backends (`mockDb.js` *et* `supabaseDb.js`), avec des
  signatures identiques.
- ⚠ **Le mock est plus permissif que Supabase — il masque des bugs de production.** `updateX` y fait
  un `Object.assign` et avale n'importe quelle clé ; PostgREST **rejette toute colonne inconnue**.
  Une modification « qui marche en mock » n'est pas vérifiée.
- Chaque page a son `reload()` qui `Promise.all` les appels repo puis `setLoading(false)`.
- **State local uniquement** (`useState`/`useMemo`). Pas de Redux, Zustand ni React Query. Un seul
  contexte : `AuthContext`.

---

## 14. Avant de livrer un écran

1. `npm run lint` — zéro nouvel avertissement (les deux d'`ui.jsx` sont connus).
2. `npm run build` — il n'y a pas de typecheck, le build est la seule barrière.
3. **Le regarder à 390 px de large**, dans une iframe, et vérifier qu'aucun contenu n'est coupé.
4. **Mesurer** les colonnes d'un tableau neuf sur les données réelles.
5. Vérifier qu'une **absence** (liste vide, champ inconnu) y est lisible, et distincte d'un « pas
   encore rempli ».
6. Si l'écran gagne une action : **compléter `aideLogic.js`**.
