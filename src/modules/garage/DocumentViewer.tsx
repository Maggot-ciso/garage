import { useEffect, useRef, useState } from 'react'
import { Share2, X } from 'lucide-react'
import type { Attachment } from '../../db/db'
import { useT } from '../../i18n/I18nProvider'
import { renderPdf } from './pdfRender'
import { shareVehicleDocument } from './vehicleDocuments'

// Full-screen, offline, in-app. Tapping a document shows the document — the
// share sheet is a button in here for when sending it is what you actually
// want, not the thing that happens instead of viewing.
export function DocumentViewer({
  document: doc,
  onClose,
}: {
  document: Attachment
  onClose: () => void
}) {
  const t = useT()
  const holder = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    let live = true
    const mount = holder.current
    if (!mount) return
    mount.replaceChildren()
    setState('loading')

    // Width is measured once, from the element the pages go into, so the
    // render is sized to the phone rather than to a guess.
    const width = Math.max(mount.clientWidth, 320)

    void renderPdf(doc.bytes, width, (page, index, total) => {
      if (!live) return
      setProgress({ done: index, total })
      page.canvas.className = 'block w-full h-auto rounded-lg bg-white'
      page.canvas.style.maxWidth = '100%'
      mount.appendChild(page.canvas)
    })
      .then(() => {
        if (live) setState('ready')
      })
      .catch(() => {
        if (live) setState('failed')
      })

    return () => {
      live = false
      mount.replaceChildren()
    }
  }, [doc])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={doc.name}
      className="fixed inset-0 z-50 flex flex-col bg-slate-900"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex shrink-0 items-center gap-2 px-3 py-2.5 text-white">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{doc.name}</span>
        <button
          type="button"
          onClick={() => void shareVehicleDocument(doc)}
          aria-label={t('documents.a11yShare')}
          className="shrink-0 rounded-lg p-2 active:bg-white/10"
        >
          <Share2 className="h-5 w-5" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('action.close')}
          className="shrink-0 rounded-lg p-2 active:bg-white/10"
        >
          <X className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 overflow-auto overscroll-contain p-3">
        {state === 'loading' && (
          <p className="py-8 text-center text-sm text-white/70">
            {progress
              ? t('documents.renderingPage', { done: progress.done, total: progress.total })
              : t('documents.opening')}
          </p>
        )}
        {state === 'failed' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <p role="alert" className="text-center text-sm text-white/80">
              {t('documents.renderFailed')}
            </p>
            <button
              type="button"
              onClick={() => void shareVehicleDocument(doc)}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900"
            >
              {t('documents.openElsewhere')}
            </button>
          </div>
        )}
        <div ref={holder} className="mx-auto flex max-w-3xl flex-col gap-3" />
      </div>
    </div>
  )
}
