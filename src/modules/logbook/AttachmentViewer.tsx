import { useEffect, useState } from 'react'
import { useT } from '../../i18n/I18nProvider'
import { X } from 'lucide-react'
import type { Attachment } from '../../db/db'
import { toBlob } from '../../db/blobCodec'
import { describeSize } from './imageProcessing'

// The object URL is created when the viewer opens and revoked when it closes.
// Leaked object URLs pin their bytes in memory for the life of the document.
export function AttachmentViewer({
  attachment,
  onClose,
}: {
  attachment: Attachment
  onClose: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const t = useT()

  useEffect(() => {
    const objectUrl = URL.createObjectURL(toBlob(attachment.bytes, attachment.mime))
    setUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
      setUrl(null)
    }
  }, [attachment])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isPdf = attachment.mime === 'application/pdf'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={attachment.name}
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
    >
      <div className="flex items-center gap-2 p-3 text-white">
        <span className="min-w-0 flex-1 truncate text-sm">{attachment.name}</span>
        <span className="shrink-0 text-sm text-white/60">{describeSize(attachment.size)}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('action.close')}
          className="shrink-0 rounded-lg p-1.5 active:bg-white/10"
        >
          <X className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto p-3">
        {url === null ? null : isPdf ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-white px-4 py-2 font-medium text-slate-900"
          >
            {t('attach.openPdf')}
          </a>
        ) : (
          <img src={url} alt={attachment.name} className="max-h-full max-w-full object-contain" />
        )}
      </div>
    </div>
  )
}
