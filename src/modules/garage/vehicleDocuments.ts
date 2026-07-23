import type { Attachment } from '../../db/db'
import { toBlob } from '../../db/blobCodec'

// Sharing a stored document — sending it somewhere, saving it to Files.
//
// This used to be what tapping a document did, and that was the wrong call:
// at a roadside check you want the PZP on screen in one tap, not a share sheet
// asking where to send it. Viewing now happens in DocumentViewer (pdf.js,
// in-app, offline). Sharing is a deliberate button.
export type ShareOutcome = 'shared' | 'opened' | 'uncertain'

export async function shareVehicleDocument(attachment: Attachment): Promise<ShareOutcome> {
  const blob = toBlob(attachment.bytes, attachment.mime)
  const file = new File([blob], attachment.name, { type: attachment.mime })

  const nav = navigator as Navigator & { canShare?: (data: unknown) => boolean }
  if (typeof navigator.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: attachment.name, files: [file] })
      return 'shared'
    } catch (err) {
      // Dismissing the sheet is a choice, not a failure — do not then fall
      // through and open a second copy in a tab behind it.
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
    }
  }

  const url = URL.createObjectURL(blob)
  // Revoking straight away can blank the tab before it has read the bytes.
  const release = () => setTimeout(() => URL.revokeObjectURL(url), 60_000)

  if (window.open(url, '_blank')) {
    release()
    return 'opened'
  }

  // A popup blocker refuses window.open but usually allows a genuine link
  // activation. It reports nothing back, hence 'uncertain'.
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
  release()
  return 'uncertain'
}
