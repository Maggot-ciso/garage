import { parseReceiptText, type ParsedReceipt } from './receiptParse'
import { extractPdfText, isPdf } from './pdfText'

export type LocalScanSource = 'pdf-text' | 'none'

export interface LocalScanResult {
  fields: ParsedReceipt
  source: LocalScanSource
}

// Everything the app can work out on its own, it works out on its own. AI is
// only consulted when this comes back empty and a key happens to be set.
export async function scanLocally(file: File): Promise<LocalScanResult> {
  if (isPdf(file)) {
    try {
      const text = await extractPdfText(file)
      const fields = parseReceiptText(text)
      // A scanned PDF has no text layer — nothing read means OCR territory
      if (Object.keys(fields).length > 0) return { fields, source: 'pdf-text' }
    } catch (err) {
      console.warn('PDF text extraction failed:', err)
    }
  }
  // Photos land here until OCR (tier 2) exists
  return { fields: {}, source: 'none' }
}

export function isUsable(fields: ParsedReceipt): boolean {
  return fields.cost !== undefined || fields.date !== undefined
}
