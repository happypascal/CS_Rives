import { useRef, useState } from 'react'
import { repo } from '../lib/api'
import { Button, UploadProgress } from './ui'
import { downloadDocument } from '../lib/documents'
import { MAX_DOC_BYTES } from '../lib/config'

// Pièces jointes, en composant contrôlé : la liste `documents` appartient à
// l'appelant, qui décide quand l'enregistrer. Cela permet de joindre un fichier
// AVANT que la ligne existe (une nouvelle entrée de chronologie), puis de tout
// enregistrer d'un coup.
//
// ⚠ « Retirer » n'efface PAS l'objet du bucket — orphelins assumés, comme
// partout ailleurs dans l'app : annuler ensuite laisserait la ligne avec un
// chemin mort, et quelques Mo perdus valent mieux qu'un devis introuvable.
//
// ⚠ `scope` et `entityId` forment le chemin `scope/entityId/<uuid>.<ext>`. Pour
// la mémoire du lotissement, l'entité est le SUJET et non l'entrée : le sujet
// existe toujours au moment de l'envoi, l'entrée pas encore.

export default function PiecesJointes({
  scope,
  entityId,
  documents = [],
  onChange,
  readOnly = false,
  label = 'Pièces jointes',
  // ⚠ PIÈCES DÉJÀ PRÉSENTES AILLEURS DANS LE MÊME DOSSIER, proposées à la reprise.
  //
  // Sans cette liste, la seule façon de mettre un document sur deux entrées était
  // de le RE-TÉLÉVERSER depuis le disque : deux objets identiques dans le bucket,
  // et deux pièces qui ne savent pas qu'elles sont la même. Question de Pascal
  // (2026-09-21) : « comment je fais pour sélectionner un document qui est déjà
  // en base ? » — on ne pouvait pas.
  disponibles = [],
}) {
  const [upload, setUpload] = useState(null)
  const [error, setError] = useState('')
  const [choisir, setChoisir] = useState(false)
  const inputRef = useRef(null)

  // Ce qu'on peut reprendre : tout ce qui est ailleurs dans le dossier et n'est
  // pas déjà ici. Comparaison sur le CHEMIN, qui identifie l'objet — deux noms
  // identiques peuvent désigner deux fichiers différents.
  const dejaIci = new Set(documents.map((d) => d.path).filter(Boolean))
  const reprenables = disponibles.filter((d) => d.path && !dejaIci.has(d.path))

  // ⚠ NOUVELLE RÉFÉRENCE, MÊME OBJET. On duplique la ligne (un `id` neuf) en
  // gardant le même `path` : le fichier n'existe qu'une fois dans le Storage,
  // il est simplement cité deux fois. Retirer l'une ne touche pas l'autre —
  // « Retirer » n'efface jamais l'objet du bucket.
  const reprendre = (doc) => {
    setChoisir(false)
    onChange?.([...documents, { ...doc, id: crypto.randomUUID(), uploaded_at: new Date().toISOString() }])
  }

  const envoyer = async (e) => {
    const file = e.target.files?.[0]
    // Le champ est remis à zéro tout de suite : sans cela, renvoyer deux fois le
    // même fichier ne déclencherait pas d'événement la seconde fois.
    e.target.value = ''
    if (!file) return
    setError('')
    if (file.size > MAX_DOC_BYTES) {
      return setError(`Fichier trop volumineux (${Math.round(file.size / 1e6)} Mo). Maximum ${Math.round(MAX_DOC_BYTES / 1e6)} Mo.`)
    }
    setUpload({ name: file.name, value: 0 })
    try {
      const record = await repo.uploadDocument(scope, entityId, file, (value) =>
        setUpload((u) => (u ? { ...u, value } : u)),
      )
      onChange([...(documents || []), record])
    } catch (err) {
      setError(`Envoi du fichier impossible : ${err.message}`)
    } finally {
      setUpload(null)
    }
  }

  const retirer = (doc) =>
    onChange((documents || []).filter((x) => (x.id || x.path) !== (doc.id || doc.path)))

  return (
    <div>
      {label && <p className="mb-1 text-sm font-medium text-slate-700">{label}</p>}

      {documents.length > 0 && (
        <ul className="mb-2 space-y-1">
          {documents.map((doc) => (
            <li key={doc.id || doc.path} className="flex items-center justify-between gap-2 rounded border border-navy-100 bg-white px-3 py-1.5">
              {/* Le bucket est privé : pas de href, l'URL se signe au clic. */}
              <button
                onClick={() => downloadDocument(doc)}
                className="min-w-0 flex-1 truncate text-left text-sm text-navy-700 hover:underline"
                title={doc.name}
              >
                {doc.name}
              </button>
              {doc.size > 0 && (
                <span className="shrink-0 text-xs text-slate-400">{Math.round(doc.size / 1024)} Ko</span>
              )}
              {!readOnly && (
                <button onClick={() => retirer(doc)} className="shrink-0 text-xs text-red-600 underline hover:text-red-800">
                  Retirer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <>
          <input ref={inputRef} type="file" className="hidden" onChange={envoyer} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={Boolean(upload)}>
              {documents.length > 0 ? 'Ajouter un fichier' : 'Joindre un fichier'}
            </Button>
            {reprenables.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setChoisir((v) => !v)} disabled={Boolean(upload)}>
                {choisir ? 'Annuler' : 'Reprendre une pièce du dossier'}
              </Button>
            )}
          </div>

          {choisir && (
            <div className="mt-2 rounded border border-navy-100 bg-navy-50/40 p-2">
              <p className="mb-1 text-xs text-slate-500">
                Ces pièces sont déjà dans ce sujet. Les reprendre ne recopie <strong>aucun
                fichier</strong> : le même document sera cité à deux endroits.
              </p>
              <ul className="space-y-1">
                {reprenables.map((doc) => (
                  <li key={doc.path}>
                    <button
                      onClick={() => reprendre(doc)}
                      className="w-full truncate rounded px-2 py-1 text-left text-sm text-navy-700 hover:bg-white"
                      title={doc.name}
                    >
                      {doc.name}
                      {doc.size > 0 && <span className="ml-2 text-xs text-slate-400">{Math.round(doc.size / 1024)} Ko</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {upload && <UploadProgress value={upload.value} name={upload.name} />}
        </>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {readOnly && documents.length === 0 && (
        <p className="text-xs italic text-slate-400">Aucune pièce jointe.</p>
      )}
    </div>
  )
}
