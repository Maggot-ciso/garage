// Rendering a stored PDF to canvases, so a document can be LOOKED AT rather
// than handed to the share sheet.
//
// The first version of this feature opened the iOS share sheet, on the theory
// that Quick Look is the better viewer. In use that is wrong: at a roadside
// check you want the PZP on screen in one tap, not a share sheet asking where
// to send it. pdf.js is already a dependency (receipt text extraction), renders
// inside the webview with no plugin, works offline, and cannot be refused by a
// popup blocker.

export interface RenderedPage {
  /** Canvas-ready bitmap of the page, already at device pixel density. */
  canvas: HTMLCanvasElement
  width: number
  height: number
}

// Cap the backing store so a long document cannot exhaust memory on a phone.
const MAX_CANVAS_EDGE = 2400

export async function renderPdf(
  bytes: ArrayBuffer,
  targetWidthCss: number,
  onPage?: (page: RenderedPage, index: number, total: number) => void,
): Promise<RenderedPage[]> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  // pdf.js transfers the buffer it is given; hand it a copy so the caller's
  // stored bytes stay usable (the same object is reused when re-rendering).
  const task = pdfjs.getDocument({ data: bytes.slice(0) })
  const doc = await task.promise
  const pages: RenderedPage[] = []

  try {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 3)
    for (let n = 1; n <= doc.numPages; n += 1) {
      const page = await doc.getPage(n)
      const unscaled = page.getViewport({ scale: 1 })
      // Fit the page to the screen width, then oversample for a sharp render.
      const fit = targetWidthCss / unscaled.width
      const scale = Math.min(fit * dpr, MAX_CANVAS_EDGE / unscaled.width)
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Could not draw the document')
      await page.render({ canvas, canvasContext: context, viewport }).promise

      const rendered: RenderedPage = {
        canvas,
        width: unscaled.width * fit,
        height: unscaled.height * fit,
      }
      pages.push(rendered)
      onPage?.(rendered, n, doc.numPages)
    }
    return pages
  } finally {
    await task.destroy()
  }
}
