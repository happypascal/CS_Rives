-- =============================================================================
-- Migration 009 — un projet peut naître de PLUSIEURS résolutions
--
-- Règle (arbitrage Pascal 2026-07-16) : une résolution porte AU PLUS un projet,
-- mais un projet peut être financé par plusieurs résolutions — augmentation de
-- budget votée l'année suivante, projet mené en phases.
--
-- Le modèle `projets.resolution_id` (une seule valeur, NOT NULL) interdisait ce
-- cas par construction. On inverse la clé étrangère : c'est la RÉSOLUTION qui
-- pointe son projet. La règle « une résolution = un seul projet » devient alors
-- structurelle — une colonne ne contient qu'une valeur — sans contrainte
-- d'unicité ni garde applicative.
--
-- `on delete set null` : supprimer un projet DÉTACHE ses résolutions, il ne les
-- détruit pas. Une résolution votée par l'AG survit toujours à un projet du CS.
--
-- Colonnes supprimées de `projets` :
--   - resolution_id : remplacée par le pointeur inverse.
--   - budget_alloue : devient DÉRIVÉ = somme des budgets des résolutions ADOPTÉES
--     rattachées. Le stocker créerait une divergence silencieuse dès qu'une
--     résolution est ajoutée ou change de statut.
--   - ag_id : n'a plus de sens — un projet financé par deux AG a deux AG
--     d'origine. La liste se dérive des résolutions rattachées.
--
-- ⚠ Migration de données AVANT le drop : chaque projet existant a exactement une
-- résolution, on la fait pointer vers lui. Aucune perte.
-- =============================================================================

alter table resolutions_ag
  add column if not exists projet_id uuid references projets(id) on delete set null;

comment on column resolutions_ag.projet_id is
  'Projet financé par cette résolution (null = enveloppe non affectée à un projet)';

-- Reprise des rattachements existants (ancien sens : projets.resolution_id).
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_name = 'projets' and column_name = 'resolution_id'
  ) then
    execute $mig$
      update resolutions_ag r
         set projet_id = p.id
        from projets p
       where p.resolution_id = r.id
         and r.projet_id is null
    $mig$;
  end if;
end $$;

create index if not exists resolutions_ag_projet_id_idx on resolutions_ag (projet_id);

alter table projets drop column if exists resolution_id;
alter table projets drop column if exists budget_alloue;
alter table projets drop column if exists ag_id;
