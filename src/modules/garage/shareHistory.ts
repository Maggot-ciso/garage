import type { Car, LogEntry } from '../../db/db'
import { buildServiceHistory, historyToHtml, historyToText } from './serviceHistory'

// Delivery is the only platform-specific part, kept thin so the tested
// formatters do the real work. Three tiers, best first:
//   1. Native/iOS share sheet with the HTML file attached (navigator.share)
//   2. Open the printable HTML in a new tab (desktop → Cmd-P → Save as PDF)
//   3. Copy the plain-text history to the clipboard (last-resort fallback)
export type ShareOutcome = 'shared' | 'opened' | 'copied' | 'failed'

function slug(car: Car): string {
  return `${car.make}-${car.model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function shareServiceHistory(
  car: Car,
  entries: LogEntry[],
  todayISO: string,
): Promise<ShareOutcome> {
  const history = buildServiceHistory(car, entries, todayISO)
  const html = historyToHtml(history)
  const filename = `${slug(car)}-service-history.html`

  // 1. Share sheet with the file (iOS, Android, native shell)
  const file = new File([html], filename, { type: 'text/html' })
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
  if (typeof navigator.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: `${history.title} — service history`, files: [file] })
      return 'shared'
    } catch (err) {
      // A user cancelling the sheet is not a failure — don't fall through then
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
    }
  }

  // 2. Open the printable document in a new tab
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const opened = window.open(url, '_blank')
  if (opened) {
    // Revoke once the tab has had time to load — immediate revoke can blank it
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return 'opened'
  }
  URL.revokeObjectURL(url)

  // 3. Clipboard fallback (popup blocked, no share support)
  try {
    await navigator.clipboard.writeText(historyToText(history))
    return 'copied'
  } catch {
    return 'failed'
  }
}
