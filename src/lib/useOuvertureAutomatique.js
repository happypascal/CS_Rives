// Filet applicatif de l'ouverture automatique des décisions planifiées
// (migration 026, spec §5).
//
// POURQUOI CE FILET EXISTE. Le planificateur nominal est pg_cron, dans la base :
// il appelle `ouvrir_decisions_planifiees('cron')` toutes les heures. Mais
// activer une extension demande des droits que le SQL Editor n'a pas toujours,
// et un pg_cron absent ne se voit pas — la décision planifiée ne s'ouvrirait
// simplement JAMAIS. Sur un registre légal, « la délibération n'a jamais été
// soumise au vote » est le pire des échecs : silencieux, et découvert trop tard.
//
// D'où un second chemin, redondant et volontairement bête : au chargement de
// l'app, on demande à la base d'ouvrir ce qui est échu. La fonction est
// STRICTEMENT idempotente (elle ne touche que `phase = 'planifiee'` et
// `date_soumission_prevue <= now()`), donc deux membres qui ouvrent l'app en
// même temps n'ouvrent pas deux fois.
//
// ⚠ Ce filet ne remplace pas le cron : il ne s'exécute que si quelqu'un ouvre
// l'app. Avec le seul filet, une décision prévue le 16 à 08:00 s'ouvre au
// premier chargement après cette heure-là — pas à l'heure dite.
//
// Pas d'écran, pas de message : c'est de la mécanique, et une décision ouverte
// ici apparaît telle quelle au prochain chargement de la liste. Un échec est
// avalé — l'ouverture réessaiera, et faire échouer l'app entière parce qu'un RPC
// a répondu 500 serait pire que le retard.
import { useEffect } from 'react'
import { repo } from './api'

export function useOuvertureAutomatique() {
  useEffect(() => {
    repo.ouvrirDecisionsDues().catch(() => {})
  }, [])
}
