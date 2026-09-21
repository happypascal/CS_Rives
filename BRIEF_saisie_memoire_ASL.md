# Brief — saisie de la mémoire de l'ASL dans le registre

> Destinataire : Claude Code, sur le dépôt `CS_Rives`.
> Auteur du contenu : session Claude (analyse du dossier `_1_lotissement` et de l'export du registre).
> Date : 20 septembre 2026.

---

## 0. Cadre et méthode — à lire avant de commencer

**Ce que tu produis** : un script Node, `scripts/import_memoire.mjs`, **calqué sur
`scripts/export_md.mjs`** — même façon de lire les identifiants, mêmes conventions, mêmes garde-fous.
Il écrit directement dans la base avec la clé `service_role`. Aucun SQL à coller à la main.

**Identifiants** : `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`, lus dans `.env.export` à la racine
du projet, les variables d'environnement restant prioritaires. Reprends la fonction `lireEnvFichier()`
d'`export_md.mjs` telle quelle, y compris sa tolérance aux caractères Unicode invisibles. **Ancre tous
les chemins à la racine du projet**, jamais au répertoire courant — même raison qu'en commentaire
d'`export_md.mjs`.

**Le contenu va dans un fichier séparé** : `scripts/data/memoire_asl_2026-09-20.mjs`, qui exporte les
sujets, les entrées et la liste des pièces. Le script d'import ne contient que la mécanique. Ça permet
de relire le contenu sans lire le code, et de le rejouer plus tard.

**Deux modes, et le mode sûr est le défaut** : sans argument, le script affiche ce qu'il ferait et
n'écrit rien. Il n'écrit qu'avec `--go`. C'est un registre légal ; une écriture en masse ne se lance
pas par inadvertance.

**Avant toute écriture, une sauvegarde.** Le script refuse de s'exécuter en `--go` si
`node scripts/backup.mjs` n'a pas tourné le jour même — vérifie la date du dernier fichier de
sauvegarde, et arrête-toi avec un message clair sinon.

**Idempotence** : `sujets` est protégé par l'unicité de `titre` ; pour les entrées, vérifie
l'existence sur le triplet (`sujet_id`, `date_evenement`, `titre`) avant d'insérer. Le script doit
pouvoir être relancé sans créer un seul doublon, et le dire dans son rapport.

**Ce que tu n'inventes pas** : aucune date. Les pièces marquées `⚠ à dater` vont dans une liste
`A_DATER` que le script imprime en fin d'exécution sans rien insérer. `date_evenement` est `not null` :
une entrée sans date certaine n'entre pas dans le registre.

**Rapport final** : nombre de sujets créés, d'entrées insérées, d'entrées ignorées car déjà
présentes, de pièces téléversées, et la liste `A_DATER`. Écris-le aussi dans
`export/import_memoire_<horodatage>.md`.

**Rappels de schéma** (`supabase/schema.sql`) :
- `sujets` : `titre` est **unique** — un doublon scinderait la connaissance en deux ;
  `categorie` est du texte libre ; `resume` tient en une ligne ; `contenu` est du HTML.
- `sujet_entrees` : `sujet_id`, `date_evenement` (date, not null), `titre` (not null), `contenu`,
  `documents` (jsonb), `auteur_id`.
- `created_by` et `auteur_id` référencent `membres_cs(id)`. Résous-les par l'e-mail
  `pfavre25@gmail.com` dans une sous-requête, jamais par un uuid en dur.

**Idempotence** : chaque `insert into sujets` se termine par `on conflict (titre) do nothing`.
Pour les entrées, encadre chaque bloc d'un `where not exists` sur le couple
(`sujet_id`, `date_evenement`, `titre`) afin que le fichier puisse être rejoué sans doublon.

**Catégories à utiliser** (texte libre, mais reste cohérent avec l'existant) :
`Juridique et statuts`, `Équipements`, `Réseaux`, `Gestion`, `Contentieux`, `Urbanisme`.

---

## 1. Sujets à créer

Sept sujets. Deux existent déjà et ne doivent pas être recréés : **Plage** et
**Statut juridique du lotissement**.

---

### 1.1 `Biens communs et indivision`

- **catégorie** : `Juridique et statuts`
- **résumé** : Les biens communs — sol des allées (parcelle B228), couloirs d'accès, plage, réseaux — sont en indivision forcée et perpétuelle entre les colotis, au prorata de la superficie de leur lot, et inséparables de celui-ci.
- **contenu** (synthèse) :

> Le régime des biens communs du lotissement ne résulte pas des statuts de 2026 mais du cahier des charges de 1955 et de son additif de janvier 1957. L'additif dispose que le sol de la rue nouvelle et les couloirs d'accès appartiennent « indivisément aux acquéreurs de tous les lots et chacun en proportion de la superficie de son lot », que cette indivision est perpétuelle, et que ces droits « ne pourront être vendus, échangés ou hypothéqués séparément du surplus de leur propriété dont ils forment l'accessoire ».
> L'assemblée du 15 septembre 2026 n'a rien changé à ce régime : la résolution 4 constate expressément que la mise en conformité des statuts intervient « sans remise en cause de la nature indivise des biens communs ». L'ASL administre ces biens ; elle n'en est pas propriétaire.

**Entrées :**

| date_evenement | titre | contenu |
|---|---|---|
| 1955-08-01 ⚠ jour à confirmer | Cahier des charges du lotissement de Rives | Acte fondateur. L'article 18 organise le syndicat des colotis, les règles de vote et de majorité. C'est lui qui, selon Me Garnier, crée de fait l'association syndicale libre. |
| 1956-02-01 ⚠ jour à confirmer | Annexe I — arbres et plage | Première annexe au cahier des charges. |
| 1956-11-19 | Signature de l'additif au cahier des charges | Additif portant sur la propriété des allées. |
| 1956-12-04 | Avis du maire de Nernier | Avis favorable préalable à l'approbation préfectorale. |
| 1957-01-09 | Arrêté préfectoral approuvant l'additif | Approbation administrative de l'additif signé le 19 novembre 1956. |
| 1957-01-15 | Acte de dépôt chez Me André Naz | Dépôt notarié de l'additif. Le nouvel article 4 dispose que le sol de la rue et les couloirs d'accès appartiennent « indivisément aux acquéreurs de tous les lots et chacun en proportion de la superficie de son lot », en perpétuelle indivision, et qu'ils « ne pourront être vendus… séparément du surplus de leur propriété dont ils forment l'accessoire ». Enregistré à Thonon le 28 janvier 1957, transcrit le 13 février 1957, volume 641 n° 41. |
| 1961-01-01 ⚠ date exacte à confirmer | Décision des colotis de garder les allées privées | Les colotis décident de conserver le caractère privé des allées plutôt que de les céder à la commune. Pièce déterminante : l'article L.318-3 du code de l'urbanisme ne permet le transfert d'office d'une voie privée dans le domaine public communal que si elle est ouverte à la circulation publique. |
| 2026-09-15 | L'assemblée approuve les statuts sans toucher à l'indivision | Résolution 4 : la mise en conformité intervient « sans remise en cause de la nature indivise des biens communs, et conformément aux articles 1 à 7 de la modification du cahier des charges approuvés en assemblée générale extraordinaire du 19 juin 2025 ». |

---

### 1.2 `Distraction zone C`

- **catégorie** : `Juridique et statuts`
- **résumé** : Sept colotis de la zone C, représentant 14 280 m² sur 104 646, demandent la distraction de leurs parcelles du périmètre de l'ASL ; la décision appartient à l'assemblée du 14 septembre 2027.
- **contenu** (synthèse) :

> Les sept propriétaires de la zone C — six sur la Route de Messery et un en haut de l'allée de Rives — ont remis au président de séance, avant l'ouverture de l'assemblée du 15 septembre 2026, une déclaration commune signée demandant l'ouverture d'une procédure de distraction collective de leurs parcelles du périmètre de l'association, sur le fondement de l'article 26 des statuts.
> Aucune résolution n'étant inscrite à l'ordre du jour sur ce point, l'assemblée n'a pas délibéré et aucune décision n'est intervenue. La demande sera instruite puis soumise à l'assemblée générale du 14 septembre 2027.
> L'article 26 exige une délibération prise à la majorité des propriétaires représentant au moins les deux tiers de la superficie des propriétés. Les sept représentent 14 280 m² ; la base résiduelle serait de 90 366 m², soit une augmentation de 15,8 % des charges pour les quarante-quatre lots restants. Leur quote-part du fonds de travaux de 183 831,14 € s'élève à environ 25 084 €.

**Entrées :**

| date_evenement | titre | contenu |
|---|---|---|
| 2025-03-12 | Consultation n° 1 — six des sept approuvent la méthode | Consultation sur le principe de modifier le cahier des charges à la double majorité plutôt qu'à l'unanimité. Clôturée le 12 mars 2025, approuvée par 82,0 % des colotis et 80,4 % des superficies. Six des sept colotis de la zone C l'ont approuvée. |
| 2025-06-19 | AGE — les sept s'abstiennent, aucun ne vote contre | Approbation des modifications du cahier des charges. Abstentions : 14 280 tantièmes, soit les sept propriétaires de la zone C. Le seul vote contre est celui de SCI Violette (2 326), qui n'appartient pas à la zone C. |
| 2026-09-15 | Remise de la déclaration commune des colotis de la zone C | Déclaration signée par les sept, remise avant l'ouverture des débats et la désignation du président de séance. Annexée aux conclusions du procès-verbal. Les signataires déclarent ne pas contester l'existence de l'ASL ni la nécessité de la mise en conformité, indiquent ne pas jouir des biens communs à l'exception de la plage à laquelle ils se déclarent prêts à renoncer, demandent l'ouverture d'une procédure de distraction collective et la précision des modalités de l'article 26, et indiquent que les frais seront portés par les demandeurs. |
| 2026-09-15 | Vote de la résolution 4 — les sept votent contre | Contre : 16 606 sur 104 646 tantièmes — Violette (2 326), Jeanlu (1 964), Gachoud Laetitia (1 526), Tkatchouk/Riabtchenkova (1 971), Deschamps Jaquier Nathalie (1 740), Kitka (2 468), Mathon Pierre et Josette (2 589), Hartwig-Ormyron Estelle (2 022). Pour : 72 854. Résolution adoptée. |
| 2026-09-15 | Résolution 28 — la demande sera inscrite à l'ordre du jour de 2027 | L'assemblée prend acte de la réception de la déclaration commune, qui sera inscrite à l'ordre du jour de la prochaine assemblée générale, fixée au 14 septembre 2027. |
| 2026-09-16 | Communication du conseil syndical à l'ensemble des colotis | « Tous les frais inhérents à cette sortie, qu'elle aboutisse ou non, seront intégralement à la charge des sept propriétaires. » Et : « Jusqu'à la décision de l'assemblée, ces sept lots demeurent membres de l'ASL et restent redevables des charges dans les mêmes conditions que les autres. » |

⚠ **Entrée supplémentaire à créer par Pascal**, dont je n'ai pas la date exacte : la réponse commune
des sept reçue par l'intermédiaire de M. et Mme Hartwig, prenant acte d'une « ouverture officielle de
la procédure », et la rectification adressée par le conseil syndical.

---

### 1.3 `Réseau eaux pluviales — mémoire de l'association`

- **catégorie** : `Réseaux`
- **résumé** : Historique du réseau d'eaux pluviales du lotissement, des audits et des échanges avec la commune et Thonon Agglo. Le chantier de réfection relève du projet RESEAU EP.
- **contenu** (synthèse) :

> Le réseau d'eaux pluviales du lotissement se déverse dans un collecteur communal de 800 mm qui passe sous l'allée privée (parcelle B228). L'état du réseau a fait l'objet d'un audit et d'une inspection visuelle. La résolution 10-2 de l'assemblée du 15 septembre 2026 a alloué 25 000 € à la conception et à l'appel d'offres, confiés à un maître d'œuvre ; le montant des travaux ne sera connu qu'au dépouillement des offres.
> Interrogé en assemblée sur le caractère suffisant du fonds de travaux, le président a indiqué qu'un expert avait évoqué un ordre de grandeur de 350 000 € et que le montant total pourrait être de l'ordre de 500 000 €, ces chiffres ne constituant pas un budget.

**Entrées :**

⚠ **Je n'ai pas les dates de la plupart des pièces de ce dossier.** Ne crée que les deux entrées
ci-dessous ; laisse les autres en commentaire avec le nom du fichier source, pour que Pascal les date.

| date_evenement | titre | contenu |
|---|---|---|
| 2022-10-06 | Lettre à la mairie de Nernier | Courrier du lotissement à la mairie. |
| 2026-09-15 | Résolution 10-2 — 25 000 € pour la conception et l'appel d'offres | L'assemblée autorise l'appel de fonds destiné à l'expert chargé du design et de l'appel d'offres pour la réfection du réseau d'eaux pluviales. |

En commentaire, à dater par Pascal : audit EP (`2034 Les Rives Nernier_Audit EP.pdf`), rapport
d'inspection visuelle, plans d'écoulement (version lotissement et version mairie), plans Thonon Agglo,
relevé EP au 500ème de janvier 2021, lettre du maire sur le réseau EP.

---

### 1.4 `Syndic et gestion`

- **catégorie** : `Gestion`
- **résumé** : Convention de gestion, restitution des archives et points de vigilance sur les documents produits par le syndic.
- **contenu** (synthèse) :

> La gestion de l'ASL est confiée à Foncia Lemanique par convention du 1er janvier au 31 décembre 2027, désignée par la résolution 7 de l'assemblée du 15 septembre 2026, le président étant mandaté pour la signer.
> Le lotissement a été géré pendant des décennies comme une copropriété, ce qui explique plusieurs formulations erronées dans les documents du syndic. Les pièces antérieures à l'ASL sont conservées sur MyFoncia et doivent être exportées avant tout changement de syndic.

**Entrées :**

| date_evenement | titre | contenu |
|---|---|---|
| 2026-09-15 | Résolution 7 — désignation de Foncia Lemanique | Convention de gestion du 1er janvier 2027 au 31 décembre 2027. Le président de séance est mandaté pour signer la convention. Adoptée à l'unanimité des exprimés. |
| 2026-09-15 | Discordance sur les 13 000 € du fonds plage | La résolution 10 du procès-verbal rattache 13 000 € à une « assemblée du 23 décembre 2022 ». Aucune assemblée ne s'est tenue à cette date : ces 13 000 € ont été votés par l'assemblée du 16 décembre 2023, qui l'écrit dans son propre texte. Erreur du syndic, à faire corriger. |

---

### 1.5 `Fonds travaux`

- **catégorie** : `Gestion`
- **résumé** : Composition, nature juridique et affectation du fonds de travaux de 183 831,14 € transmis à l'ASL.
- **contenu** (synthèse) :

> Au 31 mars 2026, le lotissement détient 183 831,14 € destinés au financement des travaux sur les biens communs : fonds de travaux 89 471,03 €, remise en fonction des portails 49 800,21 €, étude du nouveau réseau d'eaux pluviales 25 000 €, aménagement de la plage 20 159,90 € (dont 13 000 € votés le 16 décembre 2023 et 7 159,90 € en 2022), sous déduction de 600 € d'honoraires complémentaires sur les portails.
> La résolution 10 du 15 septembre 2026 constate que ces sommes sont la propriété de l'association et « ne constituent ni une créance individuelle des colotis, ni un dépôt effectué pour leur compte ». Elles sont attachées aux lots et définitivement acquises à l'association : la quote-part d'un cédant est transmise de plein droit à l'acquéreur, et toute répartition convenue entre eux est inopposable à l'association.

**Entrées :**

| date_evenement | titre | contenu |
|---|---|---|
| 2022-11-19 | Fonds plage initial — 7 159,90 € | Suppression de la rampe implantée sans titre sur le domaine fluvial, devis Part Bre du Léman retenu à 2 160 € TTC, et budget supplémentaire de 5 000 € pour l'aménagement de la plage. Appel de provisions de 7 160 € au 1er avril 2023. |
| 2023-12-16 | Étude de réaménagement et fonds complémentaire de 13 000 € | Étude confiée à RF Conseils pour 2 000 € TTC, phase 1. L'assemblée décide d'utiliser le fonds constitué de 7 159,90 € pour financer cette étude et de constituer un fonds supplémentaire de 13 000 € pour l'aménagement de la plage. |
| 2024-10-26 | État des fonds au 31 mars 2024 | Fonds de travaux 122 497,75 €, fonds aménagement plage 20 159,90 €, fonds portail 51 363,51 €. |
| 2025-06-19 | AGE — confirmation du budget plage de 20 159,90 € | L'assemblée approuve l'utilisation du budget de 20 159,90 € pour la réhabilitation de la plage. Pour : 81 584 sur 88 275 tantièmes. |
| 2026-09-15 | Résolution 10 — le fonds est la propriété de l'association | 183 831,14 € transmis à l'ASL au titre de la mise en conformité des statuts. Ces sommes ne constituent ni une créance individuelle des colotis ni un dépôt effectué pour leur compte. |
| 2026-09-15 | Résolution 19 — dotation complémentaire de 100 000 € | Confirmation de la cotisation de 50 000 € votée le 19 janvier 2026 et non encore appelée, et dotation complémentaire de 50 000 € pour l'exercice 2026-2027. Appelées pour moitié le 30 septembre 2026 et pour le solde le 31 janvier 2027. |

---

### 1.6 `Contentieux SCI Villa Aysha`

- **catégorie** : `Contentieux`
- **résumé** : Second contentieux du lotissement, fondé sur le non-respect de l'article 15 de l'additif de 1957.
- **contenu** : *(à rédiger par Pascal — je n'ai au dossier que le relevé de superficie et le formulaire signé)*

**Entrées :**

| date_evenement | titre | contenu |
|---|---|---|
| 2025-10-07 | Ordonnance de référé obtenue par Me Raimond | L'ordonnance a été notifiée à l'avocat adverse ainsi qu'à la partie concernée. Le décompte des sommes dues à l'ASL a été transmis à l'avocat adverse, sans retour malgré relance. |
| 2026-09-15 | Résolution 25 — point d'information | ⚠ La convocation et le procès-verbal désignent la société sous le nom « SCI Aicha ». La dénomination employée par toutes les assemblées de 2019 à 2023, et par la résolution 9 du même procès-verbal, est SCI Villa Aysha. |

---

### 1.7 `Assurances`

- **catégorie** : `Gestion`
- **résumé** : Responsabilité civile et protection juridique couvrant l'activité du Conseil syndical, prévues par l'article 16 des statuts.
- **contenu** (synthèse) :

> L'article 16 des statuts dispose que « le lotissement souscrit une assurance responsabilité civile et protection juridique couvrant l'activité du Conseil syndical ». L'existence, le contenu et l'étendue de cette police restent à vérifier auprès du syndic. Le volet protection juridique conditionne la capacité de l'association à financer une défense sans appel de fonds spécifique.

**Entrées :** aucune pour l'instant. À créer quand Foncia aura répondu.

---

### 1.8 `Urbanisme et servitudes`

- **catégorie** : `Urbanisme`
- **résumé** : Plan local d'urbanisme, domaine public fluvial, haies et servitudes affectant le lotissement.
- **contenu** : *(à rédiger par Pascal)*

**Entrées :** ⚠ dates inconnues pour l'essentiel. Laisse tout en commentaire, en listant les pièces :
règlement du PLU, plan de zonage, lettre de la DDT de 2021, photos des haies et des panneaux
endommagés, modifications parcellaires Luscher / Van Den Berg.

---

## 2. Corrections dans les sujets existants

À faire par `update`, pas par insertion.

| Sujet | Entrée | Correction |
|---|---|---|
| Plage | 19/06/2023 | Le titre contient « démantrant » — lire « démontrant ». |
| Statut juridique du lotissement | 05/03/2025 | Le contenu écrit « M. Ktatchouk » — lire « M. Tkatchouk ». |
| Statut juridique du lotissement | 19/06/2025 | Le contenu écrit « ORMYRON ESTELLE » ; le registre des propriétaires porte « Hartwig-Ormyron Estelle ». Harmoniser, sauf s'il s'agit de la citation littérale du procès-verbal. |

Et dans le registre des propriétaires : `Gachoud Leatitia` — lire `Laetitia`.

---

## 3. Vérification après exécution

Fais-moi un récapitulatif de ce que le SQL a créé, et prépare la requête de contrôle :

```sql
select s.titre, s.categorie, count(e.id) as entrees
from sujets s left join sujet_entrees e on e.sujet_id = s.id
group by s.id, s.titre, s.categorie order by s.categorie, s.titre;
```

---

## 4. Pièces jointes — téléversées par le script

La clé `service_role` contourne la RLS : le script téléverse lui-même. Avant de coder cette partie,
lis `src/lib/supabaseDb.js` pour reprendre **le nom du bucket, la convention de chemin**
(`sujets/<id du sujet>/<uuid>.<extension>`) et **la forme exacte de l'objet `documents`** telle que
`PiecesJointes.jsx` l'attend — nom d'origine, taille, chemin. Une pièce dont la forme diffère
s'affichera mal ou pas du tout.

Règles : une pièce déjà attachée au sujet sous le même nom de fichier est ignorée ; un fichier source
introuvable est signalé sans faire échouer le reste ; le nom d'origine est conservé tel quel, y compris
ses accents et ses espaces.

Chemins relatifs à `~/Documents/_0_Privé/Maison/Nernier/_1_lotissement/`.

**Sujet « Statut juridique du lotissement »** — pièces fondatrices, aujourd'hui absentes :
- `4_ASL/3-cahier des charges/1955 août-cahier des charges.pdf`
- `4_ASL/3-cahier des charges/1956 février-Annexe I (arbres & plage).pdf`
- `4_ASL/3-cahier des charges/1957 janvier-Annexe II (propriété allées).pdf`
- `4_ASL/0-Modification du CdC/ADDENDUM III suite au vote du 17_avril:_2025 v3.pdf`
- `4_ASL/0-Modification du CdC/Lotissement_Rives_Note_Synthese_v13.pdf`
- `4_ASL/8-avocat/MEMO Avocats 24:1:25.pdf` et `Réponses Avocats 6:2:25.pdf`

**Sujet « Biens communs et indivision »** :
- `4_ASL/1-#50-Superficies/_____allées indivision.pdf`
- `4_ASL/2-documents mairie/1961 - Décision des colotis de garder les allées privées.pdf`
- `4_ASL/2-documents mairie/cession de la plage.pdf`
- `4_ASL/2-documents mairie/plan de masse.pdf`
- `4_ASL/5-règles indivis/Liste de indivis.docx`

**Sujet « Distraction zone C »** :
- `3_procédures/Zone C/Lettre colotis zone C AG 2026.pdf`
- `4_ASL/10-zone C/3 scenarios.xlsx`
- `4_ASL/10-zone C/lettre demande de sortie.docx`
- `4_ASL/lettre M. Tkatchouk.pdf`

**Sujet « Réseau eaux pluviales »** : les neuf pièces de `2_Réseau EP/`, plus
`4_ASL/Questions pour le maitre d'oeuvre.pdf`.

**Sujet « Syndic et gestion »** : `Syndic/Comparaison Syndics.pdf`, puis la convention Foncia 2027
dès signature.

**Sujet « Fonds travaux »** : `4_ASL/Redistribution fonds travaux.pdf`,
`4_ASL/Restitution ou compensation fonds travaux.pdf`.

**Sujet « Urbanisme et servitudes »** : `PLU/reglement PLU.pdf`, `PLU/plan_zonage.pdf`,
`DDT/Lettre DDT 2021.pdf`.
