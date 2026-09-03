-- =============================================================================
-- Export des destinataires de convocation, pour `scripts/creer_groupes_colotis.py`
--
-- À exécuter dans le SQL Editor de Supabase, puis télécharger le résultat en CSV.
-- Le script Python attend exactement ces trois colonnes : nom, email, societe.
--
-- ⚠ CE FICHIER EST LA REQUÊTE, PAS SON RÉSULTAT. Le résultat contient les noms et
-- adresses de cinquante colotis : il ne doit JAMAIS entrer dans ce dépôt. Il vit
-- dans le dossier de travail de l'ASL, avec les autres pièces à données
-- personnelles (cf. docs/TRANSFERT_ASL.md, section « Reprendre le projet »).
--
-- -----------------------------------------------------------------------------
-- CE QUE FAIT LA REQUÊTE
--
-- `contacts_officiels` (migration 044) porte les SOURCES cochées sur la fiche —
-- propriétaire, second propriétaire, dirigeants, mandataire — et jamais les
-- adresses elles-mêmes. La requête déplie donc chaque parcelle en autant de
-- destinataires que de cases cochées, et ne garde que ceux qui ont réellement
-- une adresse.
--
-- ⚠ La source « dirigeant » apparaît DEUX FOIS dans le `values` : une société a
-- deux dirigeants nommables, et tous deux l'engagent — donc tous deux se
-- convoquent. N'en lister qu'un laisserait un co-gérant hors des envois.
--
-- ⚠ `distinct on (lower(email))` : une même personne peut être destinataire pour
-- deux parcelles. Lui écrire deux fois décrédibilise un envoi de l'association.
-- =============================================================================

select distinct on (lower(x.email))
       coalesce(x.nom, x.email) as nom,
       lower(x.email) as email,
       x.societe
from lots l
join proprietaires p on p.lot_id = l.id and p.date_cession is null
cross join lateral (values
  ('proprietaire',   p.nom,             p.email,             p.est_societe),
  ('proprietaire_2', p.nom_2,           p.email_2,           false),
  ('dirigeant',      p.dirigeant_nom,   p.dirigeant_email,   false),
  ('dirigeant',      p.dirigeant_nom_2, p.dirigeant_email_2, false),
  ('mandataire',     p.mandataire_nom,  p.mandataire_email,  false)
) as x (source, nom, email, societe)
where p.contacts_officiels @> array[x.source]
  and x.email is not null
order by lower(x.email), x.nom;
