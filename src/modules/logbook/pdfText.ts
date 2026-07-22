// Most garage, tyre and insurance invoices are digital PDFs with a real text
// layer — the characters are already in the file. Reading them needs no AI and
// no OCR, and it is exact. pdf.js is dynamically imported so it never lands in
// the initial bundle; you only pay for it when a PDF is actually scanned.

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  // destroy() lives on the loading task, not the document
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() })
  const doc = await task.promise
  try {
    const pages: string[] = []
    for (let n = 1; n <= doc.numPages; n += 1) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      pages.push(textContentToLines(content))
    }
    return pages.join('\n')
  } finally {
    await task.destroy()
  }
}

interface TextItemish {
  str?: string
  transform?: number[]
}

// pdf.js returns positioned fragments, not lines. Grouping by their y position
// rebuilds the visual lines — which matters because the parser anchors totals
// on a label sitting to the LEFT of the amount on the same line.
export function textContentToLines(content: { items: unknown[] }): string {
  const rows = new Map<number, { x: number; text: string }[]>()

  for (const raw of content.items) {
    const item = raw as TextItemish
    if (typeof item.str !== 'string' || item.str === '') continue
    const transform = item.transform
    const x = Array.isArray(transform) ? (transform[4] ?? 0) : 0
    const y = Array.isArray(transform) ? (transform[5] ?? 0) : 0
    // Round the baseline so fragments on the same visual line group together
    const key = Math.round(y)
    const row = rows.get(key) ?? []
    row.push({ x, text: item.str })
    rows.set(key, row)
  }

  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0]) // PDF y grows upward; top line first
    .map(([, row]) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((cell) => cell.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n')
}
