import { useRef, useState } from 'react'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Attachment } from '../../db/db'
import {
  addVehicleDocument,
  deleteAttachment,
  vehicleDocuments,
} from '../../db/attachments'
import { describeSize, rejectionReason } from '../logbook/imageProcessing'
import { useT } from '../../i18n/I18nProvider'
import { openVehicleDocument } from './vehicleDocuments'

// PZP and havarijná poistka live here rather than in the logbook: the logbook
// records what insurance *cost*, this holds the certificate you actually have
// to produce at a roadside check. Deliberately upload-and-open only.
export function VehicleDocumentsPanel({ carId }: { carId: string }) {
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null)
  const documents = useLiveQuery(() => vehicleDocuments(carId), [carId])

  if (documents === undefined) return null

  async function add(files: FileList) {
    setBusy(true)
    setNote(null)
    try {
      for (const file of Array.from(files)) {
        // PDF only here: a photo of a certificate is not what gets shown at a
        // check, and the entry attachment strip already handles photos.
        if (file.type !== 'application/pdf') throw new Error(t('documents.pdfOnly'))
        const reason = rejectionReason(file)
        if (reason) throw new Error(reason)
        const bytes = await file.arrayBuffer()
        await addVehicleDocument({
          carId,
          name: file.name,
          mime: file.type,
          size: bytes.byteLength,
          bytes,
        })
      }
    } catch (err) {
      setNote({ text: err instanceof Error ? err.message : String(err), error: true })
    } finally {
      setBusy(false)
    }
  }

  async function open(doc: Attachment) {
    setNote(null)
    // Only the last-resort tier is worth a word: the other two either put the
    // document on screen or put the share sheet up, and both speak for
    // themselves.
    if ((await openVehicleDocument(doc)) === 'uncertain') setNote({ text: t('documents.openHint'), error: false })
  }

  async function remove(doc: Attachment) {
    if (!window.confirm(t('documents.confirmDelete', { name: doc.name }))) return
    await deleteAttachment(doc.id)
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="section-title">{t('documents.title')}</h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="link-accent flex items-center gap-1.5 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          {busy ? t('documents.adding') : t('documents.add')}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void add(e.target.files)
          // Reset so picking the same file twice still fires a change
          e.target.value = ''
        }}
      />

      {documents.length === 0 ? (
        <p className="faint text-sm">{t('documents.empty')}</p>
      ) : (
        <ul className="card divide-y divide-slate-100 dark:divide-slate-800">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 px-3 py-2.5">
              <button
                type="button"
                onClick={() => void open(doc)}
                aria-label={t('documents.a11yOpen', { name: doc.name })}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <FileText className="h-5 w-5 shrink-0 text-slate-400" strokeWidth={1.8} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{doc.name}</span>
                  <span className="muted block text-xs">
                    {doc.createdAt.slice(0, 10)} · {describeSize(doc.size)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => void remove(doc)}
                aria-label={t('documents.a11yRemove', { name: doc.name })}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 active:bg-slate-100 dark:active:bg-slate-800"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {note && (
        <p role="status" className={note.error ? 'notice-error' : 'faint text-sm'}>
          {note.text}
        </p>
      )}
    </section>
  )
}
