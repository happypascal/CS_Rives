// Confirmation modale réutilisable, en remplacement du confirm() natif du navigateur.
// Pourquoi : confirm() est bloquant, hors de la charte visuelle (« document juridique »),
// et incohérent avec la primitive Modal maison. Basé sur une PROMESSE pour garder les
// points d'appel quasi identiques à l'ancien code :
//
//   const [confirm, confirmModal] = useConfirm()
//   ...
//   if (!(await confirm({ title: '…', message: '…', danger: true }))) return
//   ...
//   return (<div> … {confirmModal} </div>)   // penser à rendre l'élément
//
// `confirm` est stable (useCallback) : utilisable sans risque dans un handler.
import { useCallback, useState } from 'react'
import { Modal, Button } from './ui'

export function useConfirm() {
  // `null` = fermée. Sinon { title, message, confirmLabel, danger, resolve }.
  const [state, setState] = useState(null)

  const confirm = useCallback(
    (opts) => new Promise((resolve) => setState({ confirmLabel: 'Confirmer', danger: false, ...opts, resolve })),
    [],
  )

  // Résout la promesse en attente puis referme. `state` est forcément défini ici
  // (la modale n'est visible que dans ce cas).
  const settle = (result) => {
    state?.resolve(result)
    setState(null)
  }

  const confirmModal = (
    <Modal
      open={!!state}
      onClose={() => settle(false)}
      title={state?.title}
      footer={
        <>
          <Button variant="secondary" onClick={() => settle(false)}>Annuler</Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => settle(true)}>{state?.confirmLabel}</Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{state?.message}</p>
    </Modal>
  )

  return [confirm, confirmModal]
}
