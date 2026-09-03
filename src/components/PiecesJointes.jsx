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
}) {
  const [upload, setUpload] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

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
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={Boolean(upload)}>
            {documents.length > 0 ? 'Ajouter un fichier' : 'Joindre un fichier'}
          </Button>
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
