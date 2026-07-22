import { useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n/I18nProvider'
import { FileText, Paperclip, Trash2 } from 'lucide-react'
import type { Attachment } from '../../db/db'
import { toBlob } from '../../db/blobCodec'
import { ACCEPTED_MIME, describeSize } from './imageProcessing'
import { AttachmentViewer } from './AttachmentViewer'

export function AttachmentStrip({
  attachments,
  busy,
  onAdd,
  onDelete,
}: {
  attachments: Attachment[]
  busy?: boolean
  onAdd: (files: FileList) => void
  onDelete: (attachment: Attachment) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const t = useT()
  const [viewing, setViewing] = useState<Attachment | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="label">{t('attach.title')}</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="link-accent flex items-center gap-1.5 disabled:opacity-50"
        >
          <Paperclip className="h-4 w-4" strokeWidth={2} aria-hidden />
          {busy ? t('attach.adding') : t('action.add')}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onAdd(e.target.files)
          // Reset so picking the same file twice still fires a change
          e.target.value = ''
        }}
      />

      {attachments.length === 0 ? (
        <p className="faint text-sm">{t('attach.empty')}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="relative">
              <button
                type="button"
                onClick={() => setViewing(attachment)}
                className="block h-20 w-20 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                aria-label={t('attach.a11yView', { name: attachment.name })}
              >
                <Thumbnail attachment={attachment} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(attachment)}
                aria-label={t('attach.a11yRemove', { name: attachment.name })}
                className="absolute -right-1.5 -top-1.5 rounded-full border border-slate-200 bg-white p-1 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewing && <AttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function Thumbnail({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState<string | null>(null)
  const isPdf = attachment.mime === 'application/pdf'

  useEffect(() => {
    if (isPdf) return
    const objectUrl = URL.createObjectURL(toBlob(attachment.bytes, attachment.mime))
    setUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
      setUrl(null)
    }
  }, [attachment, isPdf])

  if (isPdf) {
    return (
      <span className="muted flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-50 text-xs dark:bg-slate-800">
        <FileText className="h-6 w-6" strokeWidth={1.5} aria-hidden />
        {describeSize(attachment.size)}
      </span>
    )
  }
  return url === null ? (
    <span className="block h-full w-full bg-slate-100 dark:bg-slate-800" />
  ) : (
    <img src={url} alt="" className="h-full w-full object-cover" />
  )
}
