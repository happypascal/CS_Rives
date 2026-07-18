-- =============================================================================
-- Migration 017 — co-validation des comptes d'une AGO (point 4)
--
-- Arbitrage Pascal : les comptes de l'exercice liés à une AG ordinaire sont
-- validés quand le TRÉSORIER ET le PRÉSIDENT ont approuvé (« les 2 doivent avoir
-- approuvé obligatoirement »). Simple attestation — on ne gère pas les documents
-- comptables (le syndic les tient). Le secrétaire, qui édite l'AG, n'approuve pas.
--
-- Une TABLE dédiée plutôt que des colonnes sur assemblees_generales : chaque
-- approbation est une ligne, naturellement bornée par la RLS `with check`. Ça
-- évite de donner au trésorier un droit d'UPDATE large sur l'AG (il pourrait
-- alors en modifier n'importe quel champ) — problème que des colonnes auraient
-- posé, la RLS ne filtrant pas par colonne.
--
-- « Comptes validés » = les DEUX lignes (tresorier + president) existent pour
-- l'AG. L'app ne montre les boutons que sur une AGO.
--
-- Dépend de is_tresorier() (migration 014). INERTE tant qu'aucun trésorier.
-- =============================================================================

create table if not exists comptes_ag (
  id           uuid primary key default gen_random_uuid(),
  ag_id        uuid not null references assemblees_generales(id) on delete cascade,
  role         text not null check (role in ('tresorier','president')),
  approuve_par uuid references membres_cs(id),
  approuve_le  timestamptz not null default now(),
  unique (ag_id, role)   -- une seule approbation par rôle et par AG
);

alter table comptes_ag enable row level security;

-- Lecture : tout membre connecté (comme partout).
drop policy if exists "comptes_ag_read" on comptes_ag;
create policy "comptes_ag_read" on comptes_ag for select to authenticated using (true);

-- Approbation : le trésorier pose SA ligne, le président la sienne — chacun en
-- s'attribuant l'approbation (approuve_par = lui). Deux policies distinctes :
-- personne ne peut approuver au nom de l'autre rôle.
drop policy if exists "comptes_ag_tresorier_insert" on comptes_ag;
create policy "comptes_ag_tresorier_insert" on comptes_ag for insert to authenticated
  with check (is_tresorier() and role = 'tresorier' and approuve_par = current_membre_id());

drop policy if exists "comptes_ag_president_insert" on comptes_ag;
create policy "comptes_ag_president_insert" on comptes_ag for insert to authenticated
  with check (is_admin() and role = 'president' and approuve_par = current_membre_id());

-- Retrait : chacun peut annuler SA propre approbation (avant l'AG). Le trésorier
-- retire la ligne trésorier, le président la sienne.
drop policy if exists "comptes_ag_tresorier_delete" on comptes_ag;
create policy "comptes_ag_tresorier_delete" on comptes_ag for delete to authenticated
  using (is_tresorier() and role = 'tresorier');

drop policy if exists "comptes_ag_president_delete" on comptes_ag;
create policy "comptes_ag_president_delete" on comptes_ag for delete to authenticated
  using (is_admin() and role = 'president');
