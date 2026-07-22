import type { Attachment } from '../../db/db'
import { toBlob } from '../../db/blobCodec'

// Opening a stored document is deliberately not a viewer we build: iOS already
// renders PDFs better than anything embeddable here, and the whole point of the
// feature is handing the phone over with the PZP already on screen.
//
// Same three-tier shape as shareHistory.ts, and the same order, because the
// real target is the Capacitor WKWebView shell:
//   1. navigator.share with the file — the iOS share sheet previews a PDF in
//      Quick Look, which is the OS viewer. This is the path the phone takes.
//   2. window.open on a blob URL — desktop browsers and the plain PWA.
//   3. A real anchor click — a popup blocker refuses window.open but usually
//      allows a genuine link activation. It succeeds more often than (2), but
//      it reports nothing back, so we cannot claim it worked.
//
// Hence 'uncertain': we tried, and we say so, rather than either inventing a
// success or showing an error for something that probably opened fine.
export type OpenOutcome = 'shared' | 'opened' | 'uncertain'

export async function openVehicleDocument(attachment: Attachment): Promise<OpenOutcome> {
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
