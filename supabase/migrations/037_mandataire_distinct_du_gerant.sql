-- =============================================================================
-- Migration 037 — LE MANDATAIRE N'EST PAS LE GÉRANT
--
-- Correction demandée par Pascal (2026-08-27) : « il manque le mandataire avec
-- tel et email (qui n'est pas le gérant qui pour est le gérant de la SCI). C'est
-- le cas pour les étrangers, on parle avec des intermédiaires. »
--
-- La 036 avait ajouté `gerant_email` / `gerant_telephone` en les présentant comme
-- « le mandataire ». C'était un contresens : ce sont DEUX personnes, pour deux
-- raisons différentes.
--
--   - Le GÉRANT est un organe de la société propriétaire. Il n'existe que si le
--     propriétaire EST une société, et il l'engage juridiquement.
--   - Le MANDATAIRE est l'intermédiaire à qui l'on parle quand on n'atteint pas
--     le propriétaire lui-même — cas courant des colotis étrangers (agence,
--     conseil, membre de la famille, régie). Il peut exister pour une PERSONNE
--     PHYSIQUE tout autant que pour une SCI, et une SCI peut parfaitement avoir
--     un gérant à l'étranger ET un mandataire sur place.
--
-- Les fondre reviendrait à écrire dans un registre légal que l'intermédiaire
-- dirige la société, ou que le gérant est un simple relais. D'où trois colonnes
-- distinctes plutôt qu'un renommage.
--
-- ⚠ Les colonnes `gerant_*` de la 036 sont CONSERVÉES telles quelles : les
-- coordonnées d'un gérant de SCI sont légitimes, seul leur libellé à l'écran
-- était faux. Rien à migrer, rien n'a encore été saisi dedans.
--
-- ⚠ RAPPEL DE FORME (éditeur SQL de Supabase) : aucune chaine vide, aucun
-- argument de formatage de `raise`, aucun guillemet dollar imbriqué, aucun
-- deux-points ni barre oblique dans une chaine, et une vérification SIMPLE.
-- =============================================================================

alter table proprietaires
  add column if not exists mandataire_nom text;
alter table proprietaires
  add column if not exists mandataire_email text;
alter table proprietaires
  add column if not exists mandataire_telephone text;

-- L'e-mail du mandataire est normalisé comme les deux autres : c'est une adresse
-- de convocation, elle servira aux mêmes appariements. Le trigger doit écouter
-- les TROIS colonnes — restreint aux deux précédentes, une correction de
-- l'adresse du mandataire passerait à côté sans que rien ne le signale.
create or replace function proprietaires_normalize_email()
returns trigger language plpgsql set search_path = public as $normalise_email_prop$
begin
  if new.email is not null then
    new.email := lower(btrim(new.email));
  end if;
  if new.gerant_email is not null then
    new.gerant_email := lower(btrim(new.gerant_email));
  end if;
  if new.mandataire_email is not null then
    new.mandataire_email := lower(btrim(new.mandataire_email));
  end if;
  return new;
end $normalise_email_prop$;

drop trigger if exists trg_proprietaires_normalize_email on proprietaires;

create trigger trg_proprietaires_normalize_email
  before insert or update of email, gerant_email, mandataire_email on proprietaires
  for each row execute function proprietaires_normalize_email();
