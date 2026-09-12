import { Fragment, useEffect, useState, useCallback, useMemo } from 'react'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Select, Modal, Spinner, Badge } from '../components/ui'
import { useConfirm } from '../components/useConfirm'
import { formatDate } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'
import { ROLE_LABELS, ROLE_TONES, ROLE_VALUES, ROLES_UNIQUES } from '../lib/rolesLogic'
import {
  ORIGINE_LABELS, ORIGINE_COURT, ORIGINE_TONES, ORIGINE_VALUES,
  compareMandats, mandatEnCours, referenceAG, divergences, veilleISO,
} from '../lib/mandatLogic'

const EMPTY = { nom: '', prenom: '', email: '', role: 'membre', date_election: '', ag_election: '', date_fin: '', actif: true }
const EMPTY_MANDAT = { role: 'membre', origine: 'election', date_debut: '', date_fin: '', ag_id: '', ag_libelle: '', observations: '' }

export default function Membres() {
  const { isAdmin } = useAuth()
  const isMobile = useIsMobile()
  const canManage = isAdmin && !isMobile
  const [loading, setLoading] = useState(true)
  const [membres, setMembres] = useState([])
  const [mandats, setMandats] = useState([])
  const [ags, setAgs] = useState([])
  const [modal, setModal] = useState(null)
  const [mandatModal, setMandatModal] = useState(null)
  const [showInactive, setShowInactive] = useState(true)
  // Historique déplié, par id de membre. Fermé par défaut : l'écran répond
  // d'abord à « qui siège aujourd'hui ? ».
  const [ouvert, setOuvert] = useState({})

  const reload = useCallback(async () => {
    const [data, m, a] = await Promise.all([
      repo.listMembres(),
      // Idiome de résilience : l'historique qui échoue ne doit pas vider l'écran
      // de la composition, qui est l'information vitale.
      repo.listMandats().catch(() => []),
      repo.listAG().catch(() => []),
    ])
    setMembres(data)
    setMandats(m)
    setAgs(a)
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Mandats groupés par membre, chacun trié du plus récent au plus ancien.
  const parMembre = useMemo(() => {
    const map = {}
    for (const m of mandats) (map[m.membre_id] ||= []).push(m)
    for (const k of Object.keys(map)) map[k].sort(compareMandats)
    return map
  }, [mandats])

  if (loading) return <Spinner />

  const visible = membres.filter((m) => showInactive || m.actif)
  const toggle = (id) => setOuvert((o) => ({ ...o, [id]: !o[id] }))

  return (
    <div>
      <PageHeader
        title="Membres du Conseil Syndical"
        subtitle="Composition actuelle et historique des mandats successifs."
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
                <th className="px-4 py-2.5 font-medium">Mandats</th>
                {canManage && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {visible.map((m) => {
                const liste = parMembre[m.id] || []
                const alertes = divergences(m, liste)
                return (
                  <Fragment key={m.id}>
                    <tr className="hover:bg-navy-50/40">
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
                      <td className="whitespace-nowrap px-4 py-3">
                        <button onClick={() => toggle(m.id)} className="text-xs text-navy-600 underline">
                          {ouvert[m.id] ? 'Masquer' : 'Voir'} ({liste.length})
                        </button>
                        {alertes.length > 0 && (
                          <span className="ml-2 text-xs text-amber-700" title={alertes.join(' ')}>⚠</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setModal(m)} className="text-xs text-navy-600 underline">Modifier</button>
                        </td>
                      )}
                    </tr>
                    {ouvert[m.id] && (
                      <tr>
                        <td colSpan={canManage ? 8 : 7} className="bg-navy-50/30 px-4 py-3">
                          <Historique
                            mandats={liste}
                            ags={ags}
                            alertes={alertes}
                            canManage={canManage}
                            onAdd={() => setMandatModal({ membre: m, mandat: { ...EMPTY_MANDAT, role: m.role } })}
                            onEdit={(mandat) => setMandatModal({ membre: m, mandat })}
                            onChanged={reload}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {/* Mobile : une carte par membre, sur 2 lignes (nom + statut, puis rôle +
            élection). L'historique se déplie aussi — c'est de la consultation,
            seule la gestion reste réservée au poste de travail. */}
        <div className="divide-y divide-navy-50 md:hidden">
          {visible.map((m) => {
            const liste = parMembre[m.id] || []
            return (
              <div key={m.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-700">{m.prenom} {m.nom}</span>
                  <Badge tone={m.actif ? 'green' : 'gray'}>{m.actif ? 'Actif' : `Ancien${m.date_fin ? ' (' + formatDate(m.date_fin) + ')' : ''}`}</Badge>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <Badge tone={ROLE_TONES[m.role] || 'gray'}>{ROLE_LABELS[m.role] || m.role}</Badge>
                  <span>Élu le {formatDate(m.date_election)}</span>
                  {m.ag_election && <span>· {m.ag_election}</span>}
                  <button onClick={() => toggle(m.id)} className="ml-auto text-navy-600 underline">
                    Mandats ({liste.length})
                  </button>
                </div>
                {ouvert[m.id] && (
                  <div className="mt-2">
                    <Historique mandats={liste} ags={ags} alertes={[]} canManage={false} onChanged={reload} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {modal && (
        <MembreModal
          membre={modal}
          membres={membres}
          mandats={parMembre[modal.id] || []}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); await reload() }}
        />
      )}
      {mandatModal && (
        <MandatModal
          membre={mandatModal.membre}
          mandat={mandatModal.mandat}
          ags={ags}
          onClose={() => setMandatModal(null)}
          onSaved={async () => { setMandatModal(null); await reload() }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- historique
// La CHRONOLOGIE des mandats d'un membre, du plus récent au plus ancien.
// ⚠ Affiche « aucun mandat enregistré » plutôt que de reconstituer une ligne à
// partir de `membres_cs` : une période inventée à l'affichage se recopierait tôt
// ou tard dans le registre comme si elle avait été constatée.
function Historique({ mandats, ags, alertes, canManage, onAdd, onEdit, onChanged }) {
  const [confirm, confirmModal] = useConfirm()

  const supprimer = async (mandat) => {
    const ok = await confirm({
      title: 'Supprimer ce mandat ?',
      message: 'La ligne disparaît de l’historique, sans laisser de trace. À réserver à une saisie erronée : un mandat qui a réellement eu lieu se corrige, il ne s’efface pas.',
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    await repo.deleteMandat(mandat.id)
    await onChanged()
  }

  return (
    <div>
      {alertes.length > 0 && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-medium">À vérifier :</p>
          <ul className="mt-1 list-disc pl-4">
            {alertes.map((a) => <li key={a}>{a}</li>)}
          </ul>
          <p className="mt-1 text-amber-700">
            La fiche du membre pilote les droits et le quorum ; l’historique raconte les mandats
            successifs. L’application ne les aligne pas toute seule — c’est au président de dire
            lequel des deux dit vrai.
          </p>
        </div>
      )}

      {mandats.length === 0 ? (
        <p className="text-xs text-slate-500">Aucun mandat enregistré pour ce membre.</p>
      ) : (
        <ul className="space-y-1.5">
          {mandats.map((mandat) => {
            const ref = referenceAG(mandat, ags)
            return (
              <li key={mandat.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                <Badge tone={ROLE_TONES[mandat.role] || 'gray'}>{ROLE_LABELS[mandat.role] || mandat.role}</Badge>
                <span className="whitespace-nowrap font-medium text-slate-700">
                  {formatDate(mandat.date_debut)} → {mandat.date_fin ? formatDate(mandat.date_fin) : 'en cours'}
                </span>
                <Badge tone={ORIGINE_TONES[mandat.origine] || 'gray'}>{ORIGINE_COURT[mandat.origine] || mandat.origine}</Badge>
                <span className="text-slate-500">{ref ? `· ${ref}` : '· AG non précisée'}</span>
                {mandat.observations && <span className="text-slate-500">· {mandat.observations}</span>}
                {canManage && (
                  <span className="ml-auto flex gap-2">
                    <button onClick={() => onEdit(mandat)} className="text-navy-600 underline">Modifier</button>
                    <button onClick={() => supprimer(mandat)} className="text-red-600 underline">Supprimer</button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canManage && (
        <div className="mt-3">
          <Button variant="secondary" onClick={onAdd}>+ Ajouter un mandat</Button>
          <p className="mt-1.5 text-xs text-slate-500">
            Pour inscrire une élection antérieure à l’application : laissez « AG de l’application »
            vide et saisissez la référence en toutes lettres, telle qu’elle figure au procès-verbal.
          </p>
        </div>
      )}
      {confirmModal}
    </div>
  )
}

// ------------------------------------------------------------- modale mandat
function MandatModal({ membre, mandat, ags, onClose, onSaved }) {
  const editing = Boolean(mandat.id)
  const [form, setForm] = useState({ ...EMPTY_MANDAT, ...mandat, ag_id: mandat.ag_id || '', ag_libelle: mandat.ag_libelle || '', date_fin: mandat.date_fin || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setError('')
    if (!form.date_debut) return setError('La date de début du mandat est obligatoire.')
    if (form.date_fin && form.date_fin < form.date_debut) {
      return setError('La fin du mandat ne peut pas précéder son début.')
    }
    // Une référence d'AG, d'une façon ou d'une autre : un mandat sans origine
    // identifiable ne prouve rien. La base ne l'impose pas (la reprise de
    // l'existant s'en serait trouvée bloquée), l'écran si.
    if (!form.ag_id && !form.ag_libelle.trim()) {
      return setError('Indiquez l’AG de l’application, ou sa référence en toutes lettres.')
    }
    setSaving(true)
    try {
      const payload = {
        membre_id: membre.id,
        role: form.role,
        origine: form.origine,
        date_debut: form.date_debut,
        date_fin: form.date_fin || null,
        ag_id: form.ag_id || null,
        ag_libelle: form.ag_libelle.trim() || null,
        observations: form.observations.trim() || null,
      }
      if (editing) await repo.updateMandat(mandat.id, payload)
      else await repo.createMandat(payload)
      await onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${editing ? 'Modifier un mandat' : 'Nouveau mandat'} — ${membre.prenom} ${membre.nom}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? '…' : 'Enregistrer'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Rôle tenu pendant ce mandat" value={form.role} onChange={set('role')}>
            {ROLE_VALUES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
          <Select label="Origine" value={form.origine} onChange={set('origine')}>
            {ORIGINE_VALUES.map((o) => <option key={o} value={o}>{ORIGINE_LABELS[o]}</option>)}
          </Select>
        </div>
        <p className="text-xs text-slate-500">
          L’assemblée générale <strong>élit</strong> les membres du conseil ; le président
          <strong> désigne</strong> parmi eux le trésorier et le secrétaire (art. 14). Les deux actes
          ouvrent un mandat, mais ils ne sont pas de la même autorité.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Début du mandat" type="date" value={form.date_debut} onChange={set('date_debut')} required />
          <Input label="Fin du mandat (vide = en cours)" type="date" value={form.date_fin} onChange={set('date_fin')} />
        </div>
        <Select label="AG de l’application (si elle y figure)" value={form.ag_id} onChange={set('ag_id')}>
          <option value="">— Aucune / AG antérieure à l’application —</option>
          {ags.map((a) => <option key={a.id} value={a.id}>{a.numero} — {formatDate(a.date_ag)}</option>)}
        </Select>
        <Input
          label="Référence de l’AG en toutes lettres"
          value={form.ag_libelle}
          onChange={set('ag_libelle')}
          placeholder="AGO du 12 juin 2018"
        />
        <Input label="Observations (optionnel)" value={form.observations} onChange={set('observations')} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}

// ------------------------------------------------------------- modale membre
function MembreModal({ membre, membres = [], mandats = [], onClose, onSaved }) {
  const editing = Boolean(membre.id)
  const [form, setForm] = useState({ ...EMPTY, ...membre })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // « Nouveau mandat » ou « correction » — voir plus bas, c'est l'arbitrage que
  // l'application ne peut pas prendre à la place du président.
  const [suite, setSuite] = useState('nouveau')
  const [confirm, confirmModal] = useConfirm()
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const courant = mandatEnCours(mandats)
  // Le mandat a-t-il changé ? Un rôle différent, ou une date d'élection
  // différente. Le reste (nom, e-mail) ne touche pas à la mandature.
  const mandatChange = editing && (form.role !== membre.role || form.date_election !== membre.date_election)

  const save = async () => {
    setError('')
    // ⚠ L'e-mail n'est exigé que d'un membre ACTIF, qui doit pouvoir se
    // connecter. Un ancien membre inscrit pour l'historique (élection de 2018,
    // parti depuis) n'aura jamais de compte : l'exiger obligerait à inventer une
    // adresse, donc à écrire une donnée fausse dans un registre légal.
    if (!form.nom || !form.prenom || !form.date_election) {
      return setError('Nom, prénom et date d’élection sont obligatoires.')
    }
    if (form.actif && !form.email) {
      return setError('Un membre actif doit avoir un e-mail : c’est lui qui relie la fiche au compte de connexion.')
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
    // Ouvrir un mandat suppose de clore le précédent la veille. Si la nouvelle
    // date tombe avant le début du mandat en cours, la période serait à l'envers
    // — la base la refuserait, autant le dire ici en français.
    if (mandatChange && suite === 'nouveau' && courant && veilleISO(form.date_election) < courant.date_debut) {
      return setError(
        `Le mandat en cours a commencé le ${formatDate(courant.date_debut)} : ` +
        'un nouveau mandat ne peut pas débuter avant. Corrigez la date, ou choisissez « correction ».',
      )
    }
    setSaving(true)
    try {
      const payload = {
        nom: form.nom,
        prenom: form.prenom,
        email: form.email || null,
        role: form.role,
        date_election: form.date_election,
        ag_election: form.ag_election || null,
        date_fin: form.date_fin || null,
        actif: form.actif,
      }
      if (editing) await repo.updateMembre(membre.id, payload)
      else {
        const cree = await repo.createMembre(payload)
        // Un membre créé sans mandat naîtrait avec un historique vide, et le
        // premier mandat serait celui qu'on oublie de saisir. On l'ouvre ici,
        // avec exactement ce que la fiche vient de déclarer.
        await repo.createMandat({
          membre_id: cree.id,
          role: form.role,
          origine: 'election',
          date_debut: form.date_election,
          date_fin: form.date_fin || null,
          ag_id: null,
          ag_libelle: form.ag_election || null,
          observations: null,
        })
      }
      if (editing && mandatChange && suite === 'nouveau') {
        // ⚠ ORDRE IMPOSÉ : clore d'abord, ouvrir ensuite. L'index partiel
        // `mandats_cs_en_cours_par_membre` refuse deux mandats ouverts, donc
        // l'ordre inverse échouerait toujours. Si la seconde écriture échoue, le
        // membre se retrouve sans mandat ouvert — cas non atomique ASSUMÉ (même
        // situation qu'au rattachement d'un projet à ses résolutions), mais
        // VISIBLE : `divergences()` l'affiche en avertissement sur la ligne.
        if (courant) await repo.updateMandat(courant.id, { date_fin: veilleISO(form.date_election) })
        await repo.createMandat({
          membre_id: membre.id,
          role: form.role,
          // Une date d'élection nouvelle = l'AG a élu. Un rôle qui change seul =
          // le président a désigné (art. 14). Modifiable ensuite dans
          // l'historique, où la cooptation est également proposée.
          origine: form.date_election !== membre.date_election ? 'election' : 'designation',
          date_debut: form.date_election,
          date_fin: form.date_fin || null,
          ag_id: null,
          ag_libelle: form.ag_election || null,
          observations: null,
        })
      }
      await onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const deactivate = async () => {
    if (!(await confirm({ title: `Désactiver ${form.prenom} ${form.nom} ?`, message: 'Le membre passera en « ancien » et ne pourra plus se connecter ni voter. Son historique est conservé, et son mandat en cours sera clos à ce jour.', confirmLabel: 'Désactiver', danger: true }))) return
    await repo.deactivateMembre(membre.id)
    // Clore le mandat en cours : un ancien membre dont la période reste ouverte
    // ferait dire à l'historique qu'il siège encore.
    if (courant) await repo.updateMandat(courant.id, { date_fin: new Date().toISOString().slice(0, 10) })
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
        <Input label="Email" type="email" value={form.email || ''} onChange={set('email')} />
        {!form.actif && (
          <p className="text-xs text-slate-500">
            E-mail facultatif pour un ancien membre : il sert à relier la fiche à un compte de
            connexion, dont un membre qui ne siège plus n’a pas besoin.
          </p>
        )}
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

        {/* ⚠ LE SEUL ARBITRAGE QUE L'APPLICATION NE PEUT PAS PRENDRE.
            Rôle ou date d'élection modifiés : s'agit-il d'une nouvelle mandature,
            ou de la correction d'une saisie fautive ? Un automatisme se
            tromperait dans un cas sur deux — et fabriquer une élection qui n'a
            pas eu lieu est la faute la plus grave possible dans un registre. */}
        {mandatChange && (
          <div className="rounded border border-navy-200 bg-navy-50/60 p-3">
            <p className="text-sm font-medium text-slate-700">Le mandat a changé. Que faut-il inscrire ?</p>
            <label className="mt-2 flex items-start gap-2 text-sm text-slate-600">
              <input type="radio" className="mt-1" checked={suite === 'nouveau'} onChange={() => setSuite('nouveau')} />
              <span>
                <strong>Un nouveau mandat</strong> — réélection, ou désignation à une fonction du
                bureau. Le mandat en cours sera clos la veille
                {courant ? ` (${formatDate(courant.date_debut)} → ${form.date_election ? formatDate(veilleISO(form.date_election)) : '…'})` : ''},
                et une nouvelle période s’ouvrira.
              </span>
            </label>
            <label className="mt-2 flex items-start gap-2 text-sm text-slate-600">
              <input type="radio" className="mt-1" checked={suite === 'correction'} onChange={() => setSuite('correction')} />
              <span>
                <strong>Une correction</strong> — la saisie précédente était fautive. L’historique
                n’est pas modifié ; corrigez-y la ligne à part si besoin.
              </span>
            </label>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
    {confirmModal}
    </>
  )
}
