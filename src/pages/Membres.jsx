import { useEffect, useState, useCallback } from 'react'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Select, Modal, Spinner, Badge } from '../components/ui'
import { useConfirm } from '../components/useConfirm'
import { formatDate } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'
import { ROLE_LABELS, ROLE_TONES, ROLE_VALUES, ROLES_UNIQUES } from '../lib/rolesLogic'

const EMPTY = { nom: '', prenom: '', email: '', role: 'membre', date_election: '', ag_election: '', date_fin: '', actif: true }

export default function Membres() {
  const { isAdmin } = useAuth()
  const isMobile = useIsMobile()
  const canManage = isAdmin && !isMobile
  const [loading, setLoading] = useState(true)
  const [membres, setMembres] = useState([])
  const [modal, setModal] = useState(null)
  const [showInactive, setShowInactive] = useState(true)

  const reload = useCallback(async () => {
    const data = await repo.listMembres()
    setMembres(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  if (loading) return <Spinner />

  const visible = membres.filter((m) => showInactive || m.actif)

  return (
    <div>
      <PageHeader
        title="Membres du Conseil Syndical"
        subtitle="Composition et historique des mandats."
        actions={canManage && <Button onClick={() => setModal(EMPTY)}>+ Ajouter un membre</Button>}
      />

      <Card className="mb-4 p-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Afficher les anciens membres
        </label>
      </Card>

      <Card className="overflow-hidden">
        {/* Desktop : tableau. Mobile : cartes 2 lignes — le tableau (6-7 colonnes)
            débordait du cadre en portrait. */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Nom</th>
                <th className="px-4 py-2.5 font-medium">Prénom</th>
                <th className="px-4 py-2.5 font-medium">Rôle</th>
                <th className="px-4 py-2.5 font-medium">Élu en</th>
                <th className="px-4 py-2.5 font-medium">AG d’élection</th>
                <th className="px-4 py-2.5 font-medium">Statut</th>
                {canManage && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {visible.map((m) => (
                <tr key={m.id} className="hover:bg-navy-50/40">
                  <td className="px-4 py-3 font-medium text-slate-700">{m.nom}</td>
                  <td className="px-4 py-3 text-slate-600">{m.prenom}</td>
                  <td className="px-4 py-3">
                    <Badge tone={ROLE_TONES[m.role] || 'gray'}>{ROLE_LABELS[m.role] || m.role}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(m.date_election)}</td>
                  <td className="px-4 py-3 text-slate-600">{m.ag_election || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={m.actif ? 'green' : 'gray'}>{m.actif ? 'Actif' : `Ancien${m.date_fin ? ' (' + formatDate(m.date_fin) + ')' : ''}`}</Badge>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setModal(m)} className="text-xs text-navy-600 underline">Modifier</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile : une carte par membre, sur 2 lignes (nom + statut, puis rôle +
            élection). */}
        <div className="divide-y divide-navy-50 md:hidden">
          {visible.map((m) => (
            <div key={m.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-700">{m.prenom} {m.nom}</span>
                <Badge tone={m.actif ? 'green' : 'gray'}>{m.actif ? 'Actif' : `Ancien${m.date_fin ? ' (' + formatDate(m.date_fin) + ')' : ''}`}</Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <Badge tone={ROLE_TONES[m.role] || 'gray'}>{ROLE_LABELS[m.role] || m.role}</Badge>
                <span>Élu le {formatDate(m.date_election)}</span>
                {m.ag_election && <span>· {m.ag_election}</span>}
                {canManage && <button onClick={() => setModal(m)} className="ml-auto text-navy-600 underline">Modifier</button>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {modal && (
        <MembreModal
          membre={modal}
          membres={membres}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); await reload() }}
        />
      )}
    </div>
  )
}

function MembreModal({ membre, membres = [], onClose, onSaved }) {
  const editing = Boolean(membre.id)
  const [form, setForm] = useState({ ...EMPTY, ...membre })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirm, confirmModal] = useConfirm()
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const save = async () => {
    setError('')
    if (!form.nom || !form.prenom || !form.email || !form.date_election) {
      return setError('Nom, prénom, email et date d’élection sont obligatoires.')
    }
    // Un seul titulaire actif par rôle du bureau (art. 14). On bloque plutôt que
    // de laisser deux présidents ou deux trésoriers coexister — is_admin() /
    // is_tresorier() renverraient vrai pour deux personnes, résultat imprévisible.
    if (form.actif && ROLES_UNIQUES.includes(form.role)) {
      const autre = membres.find((m) => m.id !== membre.id && m.actif && m.role === form.role)
      if (autre) {
        return setError(`${ROLE_LABELS[form.role]} déjà attribué à ${autre.prenom} ${autre.nom}. Changez d’abord son rôle.`)
      }
    }
    setSaving(true)
    try {
      const payload = {
        nom: form.nom,
        prenom: form.prenom,
        email: form.email,
        role: form.role,
        date_election: form.date_election,
        ag_election: form.ag_election || null,
        date_fin: form.date_fin || null,
        actif: form.actif,
      }
      if (editing) await repo.updateMembre(membre.id, payload)
      else await repo.createMembre(payload)
      await onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const deactivate = async () => {
    if (!(await confirm({ title: `Désactiver ${form.prenom} ${form.nom} ?`, message: 'Le membre passera en « ancien » et ne pourra plus se connecter ni voter. Son historique est conservé.', confirmLabel: 'Désactiver', danger: true }))) return
    await repo.deactivateMembre(membre.id)
    await onSaved()
  }

  return (
    <>
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Modifier le membre' : 'Nouveau membre'}
      footer={
        <>
          {editing && form.actif && <Button variant="danger" onClick={deactivate} className="mr-auto">Désactiver</Button>}
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? '…' : 'Enregistrer'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Nom" value={form.nom} onChange={set('nom')} required />
          <Input label="Prénom" value={form.prenom} onChange={set('prenom')} required />
        </div>
        <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Rôle" value={form.role} onChange={set('role')}>
            {ROLE_VALUES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
          <Input label="Date d’élection" type="date" value={form.date_election || ''} onChange={set('date_election')} required />
        </div>
        <Input label="AG d’élection" value={form.ag_election || ''} onChange={set('ag_election')} placeholder="AGO 19 juin 2025" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Fin de mandat (optionnel)" type="date" value={form.date_fin || ''} onChange={set('date_fin')} />
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.actif} onChange={set('actif')} /> Membre actif
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
    {confirmModal}
    </>
  )
}
