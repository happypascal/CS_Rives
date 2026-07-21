// Notifications de bureau (Notifications API) pour le PRÉSIDENT et le SECRÉTAIRE.
// Tant que l'application reste ouverte, un sondage toutes les 30 s détecte les
// NOUVEAUX votes et NOUVELLES questions et affiche une notification système.
//
// Choix assumés :
//  - Confort d'alerte, PAS une preuve de notification (ça reste l'email / le PV).
//  - AUCUN backend : ni service worker, ni serveur push, ni Edge Function. L'app
//    doit donc rester ouverte (onglet même en arrière-plan de Chrome). Onglet
//    fermé = pas de notif — c'est l'usage voulu (« on garde l'app ouverte »).
//  - Réservé au président et au secrétaire (les autres n'en ont pas l'usage).
//  - On ne se notifie jamais de ses PROPRES votes/questions.
//
// Activation : bouton dans Paramètres — le navigateur EXIGE un geste utilisateur
// pour demander la permission. Drapeau localStorage `activity_notifs` = on/off,
// relu à chaque tick → activer/désactiver prend effet en moins de 30 s.
import { useEffect, useRef } from 'react'
import { repo } from './api'
import { useAuth } from './AuthContext'

const KEY = 'activity_notifs'
const INTERVAL_MS = 30000

// Vrai si les notifs sont utilisables ET explicitement activées par l'utilisateur.
export function activityNotifsEnabled() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted' && localStorage.getItem(KEY) === 'on'
}
export function setActivityNotifs(on) {
  localStorage.setItem(KEY, on ? 'on' : 'off')
}

export function useActivityNotifications() {
  const { user, isAdmin, isSecretaire } = useAuth()
  const canUse = isAdmin || isSecretaire
  // Base de référence des votes/questions déjà vus. `null` = pas encore établie
  // (premier passage après activation : on mémorise sans notifier l'historique).
  const baseline = useRef(null)

  useEffect(() => {
    if (!canUse) return
    let stopped = false

    const notify = (title, decisionId, numero) => {
      const n = new Notification(title, {
        body: numero ? `Décision ${numero}` : 'Sur une décision du CS',
        tag: `${title}:${decisionId}`, // remplace une notif identique au lieu d'empiler
        icon: '/favicon.svg',
      })
      n.onclick = () => { window.focus(); window.location.assign(`/registre/${decisionId}`) }
    }

    const tick = async () => {
      if (stopped) return
      // Désactivé (ou permission révoquée) : on oublie la base pour ne pas
      // notifier d'un coup tout ce qui s'est passé pendant la coupure au réactivation.
      if (!activityNotifsEnabled()) { baseline.current = null; return }

      const [votes, qa, decisions] = await Promise.all([
        repo.listVotes().catch(() => null),
        repo.listQA().catch(() => null),
        repo.listDecisions().catch(() => null),
      ])
      if (stopped || !votes || !qa) return

      const numeroById = {}
      for (const d of decisions || []) numeroById[d.id] = d.numero
      const voteKeys = new Set(votes.map((v) => `${v.decision_id}:${v.membre_id}`))
      const questions = qa.filter((x) => x.type === 'question')
      const questionIds = new Set(questions.map((q) => q.id))

      if (!baseline.current) {
        baseline.current = { votes: voteKeys, questions: questionIds }
        return
      }

      for (const v of votes) {
        const k = `${v.decision_id}:${v.membre_id}`
        if (!baseline.current.votes.has(k) && v.membre_id !== user?.membre_id) {
          notify('Nouveau vote', v.decision_id, numeroById[v.decision_id])
        }
      }
      for (const q of questions) {
        if (!baseline.current.questions.has(q.id) && q.auteur_id !== user?.membre_id) {
          notify('Nouvelle question', q.decision_id, numeroById[q.decision_id])
        }
      }
      baseline.current = { votes: voteKeys, questions: questionIds }
    }

    tick()
    const id = setInterval(tick, INTERVAL_MS)
    return () => { stopped = true; clearInterval(id) }
  }, [canUse, user?.membre_id])
}
