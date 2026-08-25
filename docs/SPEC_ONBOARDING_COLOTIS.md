# Spécification — Connexion des colotis à l'application

> **Statut : projet de spécification, rien n'est codé.** Rédigée le 2026-08-25 à la demande de
> Pascal, avant tout développement, parce que le besoin « membre de l'équipe projet ouvert aux
> colotis » ne s'ajoute pas : il ouvre l'application à des personnes qui ne sont pas membres du
> Conseil Syndical, ce qui change le modèle de lecture de **toutes** les tables.
>
> Ce document décrit ce qu'il faudrait faire, pose les questions à trancher, et **ne décide pas à
> la place du CS** sur les points de gouvernance. À lire avec `CLAUDE.md` (§Supabase, §ARTICLE 15).

---

## 1. Le besoin

Deux demandes convergent vers la même brique manquante.

**Membre de l'équipe projet** (Pascal, 2026-08-25) — « Ce rôle peut être assigné à n'importe quel
coloti. Nous avons des demandes pour aider et participer par des colotis membres du conseil
municipal, ce qui peut aider sur certains dossiers. Le membre voit tout dans le projet mais ne peut
pas créer de décision. Pour le reste, le membre ne voit rien de plus qu'un coloti. »

**Registre consultable par les colotis** — la colonne `decisions.visibilite` (`cs_seul` / `colotis`)
existe depuis la migration 026, elle est saisie, affichée et tracée. Elle **n'a aucun lecteur** :
marquer une décision « ouverte aux colotis » ne la montre à personne, faute de coloti connecté.

Les deux se ramènent à une seule question : **comment un coloti obtient-il un accès, et que
voit-il ?**

---

## 2. Le point dur, à comprendre avant tout le reste

L'application n'a aujourd'hui **qu'une seule population** : les membres du CS. Cela se traduit par
une règle unique, posée sur **chaque table** :

```sql
create policy "read_auth" on <table> for select to authenticated using (true);
```

**Tout utilisateur authentifié lit tout.** Le premier compte coloti créé aujourd'hui verrait donc,
sans rien faire de particulier : l'intégralité du registre des décisions, **le vote nominatif de
chaque membre** sur chaque délibération, tous les budgets, les procès-verbaux rattachés, la liste
des membres avec leurs emails, et le journal d'audit.

> ⚠ **Ouvrir l'application aux colotis n'est pas « ajouter un rôle ». C'est refermer puis réécrire
> la lecture de chaque table.** Sur un registre légal en service, c'est le chantier le plus
> sensible entrepris jusqu'ici — plus que la signature ou les notifications.

Deux exceptions déjà en place montrent la forme que prendra ce travail : les brouillons privés
(`decisions_avant_soumission_privee`) et les pièces jointes associées (`documents_brouillon_prive`),
toutes deux en policies **restrictives**. Le reste est à faire.

---

## 3. Où vivent les colotis — le choix structurant

### 3.1 Ce qu'il ne faut pas faire

**Ne pas verser les colotis dans `membres_cs`.** C'est la solution qui vient à l'esprit, et elle
corromprait le registre :

- `activeMembersAt()` calcule la **composition du CS appelée à voter** en filtrant `membres_cs` sur
  les dates de mandat. Un coloti y figurant serait compté dans le **dénominateur du quorum** et
  dans la liste des **signataires** de l'article 15 ;
- `membres_cs.date_election` est `not null` : il faudrait inventer une date d'élection pour
  quelqu'un qui n'a jamais été élu, donc écrire une information fausse dans un registre légal ;
- `current_membre_id()` — l'ancre d'identité de **toute** la RLS — renverrait une identité de
  coloti là où le code attend un membre.

C'est un piège à conséquence juridique, pas seulement technique. À écrire noir sur blanc dans
`CLAUDE.md` le jour où on codera.

### 3.2 Le fait à ne pas manquer

**Tout membre du CS est aussi un coloti.** Un membre dont le mandat se termine ne disparaît pas :
il redevient un coloti ordinaire, et devrait garder son accès en cette qualité. Le modèle doit
donc distinguer **la personne** (propriétaire d'un lot) de **son mandat** (membre du conseil).

### 3.3 Les deux modèles possibles

**(A) Modèle propre — une table `colotis`, `membres_cs` la référence.**

```
colotis      (id, nom, prenom, email, lot, actif, …)
membres_cs   (… + coloti_id → colotis.id)
```

Le CS devient une **qualité** portée par une personne, pas une population séparée. Fin de mandat =
la ligne `membres_cs` se termine, la ligne `colotis` demeure. Un seul compte Auth par personne, un
seul email.

*Coût* : une migration qui touche l'ancre d'identité de toute la RLS. `current_membre_id()` doit
continuer de fonctionner à l'identique pour ne rien casser, et une seconde fonction
`current_coloti_id()` apparaît. Il faut reprendre chaque policy existante.

**(B) Modèle minimal — une table `colotis` pour les seuls non-membres.**

Moins de reprise immédiate, mais une personne qui entre au CS puis en sort existerait en double, et
il faudrait gérer à la main le passage d'une table à l'autre — c'est-à-dire, tôt ou tard, un
doublon avec deux emails et deux comptes.

**Recommandation : (A).** Le coût est concentré sur une migration, alors que (B) crée une dette
permanente. Et le cas « fin de mandat » est certain, pas hypothétique : le CS est renouvelé
le 15 septembre 2026.

---

## 4. Onboarding — comment un coloti obtient un compte

C'est le cœur de la demande (« la connexion automatique des colotis »). La difficulté n'est pas
technique, elle est de **preuve** : comment sait-on que la personne qui s'inscrit est bien
propriétaire d'un lot du lotissement ?

Aujourd'hui, l'application interdit l'auto-inscription — les comptes sont créés à la main dans
Supabase par Pascal (`schema.sql` : « Pas d'auto-inscription »). Ouvrir aux colotis suppose de
lever cette règle, avec une contrepartie.

### 4.1 Trois mécanismes, du plus sûr au plus ouvert

| | Mécanisme | Preuve d'appartenance | Charge pour le CS |
|---|---|---|---|
| **1** | **Invitation depuis le rôle** — le CS charge la liste des colotis (nom, lot, email) et envoie les invitations | Forte : seuls les gens du rôle entrent | Charger et tenir la liste à jour |
| **2** | **Revendication de compte** — le coloti s'inscrit, l'app le rapproche d'une ligne du rôle (email, ou lot + nom), le secrétaire valide | Forte, si le rôle est fiable | Une validation par personne |
| **3** | **Auto-inscription libre** | Aucune | Nulle — et ingérable |

**Recommandation : 1 comme socle, 2 comme confort.** Le rôle des colotis est la source de vérité ;
la revendication évite au CS d'envoyer et de relancer des invitations une par une. **Le 3 est à
écarter** : sans preuve, n'importe qui accède aux délibérations d'une association de propriétaires.

### 4.2 La question préalable, non technique

> **Qui détient le rôle des colotis, et sous quelle forme ?** C'est Foncia qui tient la liste des
> propriétaires et des lots. Le CS en dispose-t-il ? À jour ? Exploitable (tableur) ? Avec les
> emails ?

**Rien ne peut être codé avant cette réponse.** Sans rôle exploitable, aucun des mécanismes 1 et 2
ne tient, et il ne reste que le 3, qu'il faut écarter. C'est le premier point à régler, et il se
règle par un courrier à Foncia, pas dans l'application.

### 4.3 Mécanique Supabase

- Un utilisateur Auth par coloti, apparié à `colotis.email` — **même modèle que les membres**, avec
  le même piège de casse déjà rencontré (migration 018) : normaliser l'email à l'écriture.
- Invitation via `inviteUserByEmail`, ou lien magique. Le parcours « définir son mot de passe au
  premier accès » existe déjà (`ForcePasswordChange`) et se réutilise tel quel.
- ⚠ **Dépendance à l'envoi d'e-mails.** Le projet n'a **pas de domaine vérifié** — c'est le même
  blocage que les notifications automatiques (voir le backlog). Les invitations partiraient par
  l'expéditeur par défaut de Supabase : quota bas, et un risque réel d'arriver en indésirables.
  Pour dix colotis c'est tenable ; pour tout le lotissement, non. **L'onboarding des colotis et
  l'achat du domaine sont le même sujet.**

---

## 5. Matrice des droits visée

Quatre populations, à lire de la plus restreinte à la plus large.

| | Coloti | Membre d'équipe projet | Membre du CS | Président |
|---|---|---|---|---|
| Décisions `visibilite = colotis` **et enregistrées** | Lecture | Lecture | Lecture | Lecture |
| Décisions `cs_seul`, brouillons, votes en cours | — | — | Lecture | Lecture |
| Vote nominatif de chaque membre | **à trancher** | **à trancher** | Lecture | Lecture |
| Fiche projet, budget, documents, fil d'échanges | — | **Lecture + écriture du fil** | Lecture | Lecture |
| Décisions rattachées au projet | — | **à trancher** | Lecture | Lecture |
| Créer / modifier une décision | — | **Non** | Oui | Oui |
| Voter | — | **Non** | Oui | Oui |
| AG, résolutions, budgets consolidés, membres, audit | — | — | Lecture | Lecture + écriture |

Le « membre d'équipe projet » est donc **un coloti plus un projet** : il ne gagne de droits que sur
le projet auquel il est rattaché, et jamais le droit de délibérer.

### 5.1 Les deux points à trancher par le CS

**(a) Un membre d'équipe voit-il les décisions du CS rattachées à son projet ?**
« Il voit tout dans le projet » se lit naturellement comme oui. Mais ces décisions sont des
délibérations du conseil, dont certaines ne sont pas marquées accessibles aux colotis. Trois
positions possibles :

1. il voit le projet mais **aucune** décision au-delà de ce qu'un coloti voit ;
2. il voit **l'objet et le montant** des décisions du projet, sans le détail du vote ;
3. il voit **tout**, votes nominatifs compris.

*Recommandation : 2.* Elle donne ce qui sert à travailler — ce qui a été décidé et pour quel
montant — sans exposer qui a voté quoi à une personne extérieure au conseil.

**(b) Un coloti voit-il le vote nominatif sur une décision publiée ?**
L'article 15 impose que les délibérations soient **signées par tous les membres présents** : le
registre porte donc, par nature, l'identité de ceux qui ont délibéré. Faut-il pour autant publier
le sens du vote de chacun ? *Recommandation : publier le résultat et les signataires, pas le
détail nominatif pour/contre/abstention.* À confirmer avec Me Garnier, en même temps que la
révision des statuts.

---

## 6. Conséquences techniques à prévoir

1. **Réécriture de `read_auth` sur chaque table** — `membres_cs`, `assemblees_generales`,
   `resolutions_ag`, `projets`, `decisions`, `votes`, `questions_reponses`,
   `questions_reponses_projet`, `signature_batches`, `decision_status_history`,
   `decisions_historique`, `comptes_ag`, `cron_runs`, `audit_log`. Aucune ne peut rester en
   `using (true)`.
2. **Le Storage suit** — le bucket `documents` est ouvert à tout authentifié (hors brouillons,
   depuis la 026). Un coloti ne doit pas lire les devis d'un projet auquel il n'appartient pas.
3. **`current_membre_id()` renverra `null` pour un coloti.** Toutes les policies d'écriture qui
   s'appuient dessus (`votes_self_write`, `qa_self_insert`, `decisions_owner_*`, `projets_chef_*`)
   refuseront alors l'écriture — c'est le bon défaut, mais **il faut le vérifier une par une**, pas
   le supposer.
4. **Table de rattachement** `projet_equipe (projet_id, personne_id, role, ajoute_par, ajoute_le)`,
   avec le chef ou l'adjoint comme seuls habilités à ajouter un membre.
5. **`questions_reponses_projet.auteur_id` pointe `membres_cs`** (migration 028) : à faire évoluer
   vers l'identité unifiée, sinon un membre d'équipe ne pourra pas écrire dans le fil — ce qui est
   pourtant sa raison d'être.
6. **Le mock doit suivre.** Il reproduit déjà les policies sensibles ; il devra reproduire celles-ci
   aussi, faute de quoi la démo montrera un écran que la production refuse. ⚠ Rappel : **le mock ne
   prouve rien sur la RLS.** Ce chantier se valide **sur staging**, qui est aujourd'hui en pause et
   n'a que les migrations jusqu'à ~017 : le remettre à niveau est un prérequis.
7. **Écrans nouveaux** : page d'inscription / revendication, écran de validation pour le
   secrétaire, gestion du rôle des colotis, vue « registre des colotis » (liste réduite aux
   décisions publiées), section « Équipe » dans la fiche projet avec ajout et retrait.

---

## 7. Données personnelles

Tenir un rôle nominatif de propriétaires avec leurs emails est un traitement de données
personnelles. Rien de lourd pour une ASL, mais à ne pas découvrir après coup : finalité
(convocation, information, participation aux projets), base légale (exécution des statuts),
conservation (durée de propriété du lot), information des personnes au moment de l'invitation, et
droit d'accès et de rectification. Une mention d'une dizaine de lignes dans le courrier
d'invitation suffit ; elle doit exister.

---

## 8. Séquence proposée

| Étape | Contenu | Bloqué par |
|---|---|---|
| 0 | **Obtenir le rôle des colotis** (Foncia) | Rien — à lancer tout de suite |
| 0 bis | **Trancher §5.1 (a) et (b)** en CS | Rien |
| 1 | Domaine vérifié + envoi d'e-mails | Budget AG |
| 2 | Remise à niveau du **staging** | Rien |
| 3 | Identité unifiée (modèle A) + `colotis` | 0 |
| 4 | Réécriture des policies de lecture, **validée sur staging** | 2, 3 |
| 5 | Onboarding (invitation + revendication) | 1, 3 |
| 6 | Registre des colotis (lecteur de `visibilite`) | 4 |
| 7 | Équipe projet : rattachement, fil ouvert aux membres d'équipe | 4, 5 |

Les étapes 0, 0 bis et 2 ne coûtent rien et débloquent tout le reste. **Aucune ligne de code ne
devrait être écrite avant que 0 et 0 bis soient réglés** : le mécanisme d'inscription dépend
entièrement de la nature du rôle disponible, et la matrice des droits dépend d'un arbitrage qui
appartient au conseil.

---

## 9. Ce qui est déjà en place et servira

- `decisions.visibilite` (`cs_seul` / `colotis`), saisie, affichée, modifiable par le président
  même après enregistrement, et **tracée** dans `audit_log` (migrations 026 et 027). Il ne manque
  que le lecteur.
- **Chef et adjoint de projet** aux mêmes droits (migration 028) : la notion d'équipe existe déjà
  côté CS, il reste à l'ouvrir vers l'extérieur.
- **Fil d'échanges par projet** (migration 028), aujourd'hui réservé au CS — c'est exactement le
  support de travail visé pour l'équipe élargie.
- Le **parcours de premier mot de passe** (`ForcePasswordChange`) se réutilise sans modification.
- Les policies **restrictives** de la migration 026 donnent le patron du travail à faire : fermer
  par verbe, ne jamais supposer qu'un `select` fermé ferme aussi l'écriture.
