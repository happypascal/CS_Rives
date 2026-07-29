-- =============================================================================
-- Migration 021 — plus de saisie Q/R / commentaire sur une décision ENREGISTRÉE
--
-- `qa_self_insert` n'exigeait que `auteur_id = current_membre_id()`. L'UI a été
-- durcie (les champs de saisie disparaissent sur une décision figée), mais la RLS
-- autorisait encore l'insert via l'API. On aligne sur `votes_self_write` : une
-- décision enregistrée (figée au registre) n'accepte plus ni vote, ni question,
-- ni réponse, ni commentaire — garanti au NIVEAU SERVEUR, pas seulement dans l'UI.
--
-- N'affecte que l'INSERT : la LECTURE (read_auth) reste ouverte, donc les Q/R déjà
-- saisies avant l'enregistrement restent visibles.
-- =============================================================================

drop policy if exists "qa_self_insert" on questions_reponses;
create policy "qa_self_insert" on questions_reponses for insert to authenticated
  with check (
    auteur_id = current_membre_id()
    and exists (select 1 from decisions d where d.id = decision_id and d.enregistree = false)
  );
