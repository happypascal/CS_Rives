-- =============================================================================
-- Migration 012 — bucket privé `documents` + policies
--
-- Pourquoi : les pièces jointes sont aujourd'hui des dataUrl base64 dans le
-- jsonb `decisions.documents` / `projets.documents`. Le base64 gonfle de 33 %,
-- la ligne de la décision porte donc le fichier entier, et le plafond applicatif
-- est à 2 Mo — trop bas pour un vrai devis d'entreprise. Le fichier sort de la
-- base ; `documents[]` ne gardera que {path,name,type,size}.
--
-- Bucket PRIVÉ, jamais public : les devis d'entreprise ne doivent pas être
-- lisibles par quiconque a l'adresse. L'app demandera une URL signée (courte
-- durée) au moment du clic. Corollaire : on stocke un CHEMIN, pas une URL — une
-- URL signée serait expirée à la relecture, et un registre légal se relit dans
-- dix ans.
--
-- Convention de chemin, PORTEUSE (ne pas la changer sans relire les policies) :
--     decisions/<decision_id>/<uuid>.<ext>
--     projets/<projet_id>/<uuid>.<ext>
-- L'id de l'entité est DANS le chemin pour que les policies puissent relire la
-- ligne correspondante. C'est ce qui permet de refuser la suppression d'un
-- fichier attaché à une décision ENREGISTRÉE : sans l'id dans le chemin,
-- `storage.objects` ne sait rien de la délibération, et le verrou légal de
-- l'art. 15 — aujourd'hui assuré par le `with check (… enregistree = false)` de
-- `decisions_owner_update`, le jsonb étant dans la ligne — serait perdu en
-- sortant les octets de la table. Écarté pour cette raison : ranger par
-- uploadeur (`<membre_id>/<uuid>`), plus simple mais aveugle à la décision.
--
-- Conséquence côté code (l'autre moitié du changement, PAS encore poussée) :
-- `DecisionForm` doit tirer l'id de la décision côté client (crypto.randomUUID)
-- et le passer à l'insert, parce qu'à la création l'upload a lieu AVANT que la
-- ligne existe. C'est aussi pourquoi l'insert ci-dessous n'exige pas que la
-- décision existe : au moment du premier upload, elle n'existe pas encore.
-- =============================================================================

-- Le bucket. 25 Mo/fichier : au-dessus de tout devis PDF réaliste, et assez bas
-- pour que le 1 Go du plan gratuit reste une limite lointaine. Un seul nombre à
-- changer ici et dans le plafond applicatif s'il faut monter.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 26214400)
on conflict (id) do update
  set public = false,
      file_size_limit = 26214400;

-- Lecture : tout membre connecté lit tout — même règle que `read_auth` sur les
-- tables. Le bucket étant privé, « lire » veut dire « obtenir une URL signée ».
drop policy if exists "documents_read_auth" on storage.objects;
create policy "documents_read_auth" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents');

-- Écriture : membre actif, et jamais sur une décision enregistrée.
--
-- `(storage.foldername(name))[2]` = le <decision_id> du chemin. On compare
-- `d.id::text` au segment, et surtout PAS l'inverse : caster un segment de
-- chemin quelconque en uuid lèverait une erreur au lieu de renvoyer faux.
-- Un chemin malformé ne correspond donc à aucune ligne — il ne débloque rien
-- puisque le NOT EXISTS ne protège que les décisions figées.
drop policy if exists "documents_insert_membre" on storage.objects;
create policy "documents_insert_membre" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and exists (
      select 1 from public.membres_cs m
      where m.id = public.current_membre_id() and m.actif
    )
    and not exists (
      select 1 from public.decisions d
      where d.id::text = (storage.foldername(name))[2]
        and d.enregistree
    )
  );

-- Pas de policy UPDATE, volontairement : chaque fichier est écrit sous un uuid
-- neuf, donc rien n'est jamais écrasé. Sans policy, l'écrasement est impossible
-- — ce qui est la garantie recherchée sur un registre.

-- Suppression : président, ou l'owner de la décision (celui-là même qui peut
-- encore la modifier) — et dans les deux cas jamais sur une décision
-- enregistrée. Les chemins `projets/…` ne matchent aucune décision : le
-- NOT EXISTS les laisse passer, et seul `is_admin()` les couvre, ce qui est
-- exactement le droit d'écriture des projets en base (`write_admin` seul).
drop policy if exists "documents_delete" on storage.objects;
create policy "documents_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and not exists (
      select 1 from public.decisions d
      where d.id::text = (storage.foldername(name))[2]
        and d.enregistree
    )
    and (
      public.is_admin()
      or exists (
        select 1 from public.decisions d
        where d.id::text = (storage.foldername(name))[2]
          and d.created_by = public.current_membre_id()
      )
    )
  );
