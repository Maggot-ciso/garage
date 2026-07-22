import { askAi } from '../../ai/aiClient'
import { type LineItem, ENTRY_CATEGORIES, type EntryCategory } from '../../db/db'
import type { EntryFields } from '../../db/entries'
import { pricePerLitre, roundMoney } from './entryValidation'

export interface InvoiceFields {
  category?: EntryCategory
  date?: string
  cost?: number
  litres?: number
  odometer?: number
  notes?: string
  /** Who was paid (receipt issuer) */
  company?: string
  /** Itemised receipt breakdown, prices incl. DPH */
  items?: LineItem[]
}

const SYSTEM = `You extract data from photos or PDF documents of car-related receipts and invoices (fuel stations, garages, tyre shops, insurers).
Reply with ONLY a JSON object, no markdown fences, with these keys:
"category" (one of: ${ENTRY_CATEGORIES.join(', ')} — fuel for gas station receipts, service for scheduled maintenance, repair for fixes, tyres for tyre work, insurance for policies, other if unclear),
"date" (ISO YYYY-MM-DD), "cost" (grand total as number), "litres" (fuel volume, number),
"odometer" (km reading if printed, number), "notes" (very short description, e.g. vendor + what was done).
Use null for anything not visible. Amounts use dot as decimal separator.`

export function parseInvoiceJson(raw: string): InvoiceFields {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null) return {}
  const obj = parsed as Record<string, unknown>
  const num = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined
  const category = ENTRY_CATEGORIES.find((c) => c === obj.category)
  const date =
    typeof obj.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.date) ? obj.date : undefined
  const notes =
    typeof obj.notes === 'string' && obj.notes.trim() ? obj.notes.trim().slice(0, 120) : undefined
  return {
    ...(category ? { category } : {}),
    ...(date ? { date } : {}),
    ...(num(obj.cost) !== undefined ? { cost: num(obj.cost) } : {}),
    ...(num(obj.litres) !== undefined ? { litres: num(obj.litres) } : {}),
    ...(num(obj.odometer) !== undefined ? { odometer: num(obj.odometer) } : {}),
    ...(notes ? { notes } : {}),
  }
}

// A scan is auto-saveable only when the essentials were read with certainty;
// anything less falls back to the pre-filled review form.
export function toAutoEntry(
  fields: InvoiceFields,
  carId: string,
  fallbackOdometer: number,
): EntryFields | null {
  if (!fields.date || fields.cost === undefined || !fields.category) return null
  if (fields.category === 'fuel' && (fields.litres === undefined || fields.litres <= 0)) {
    return null
  }
  return {
    carId,
    category: fields.category,
    date: fields.date,
    cost: roundMoney(fields.cost),
    odometer: fields.odometer ?? fallbackOdometer,
    ...(fields.notes ? { notes: fields.notes } : {}),
    ...(fields.company ? { company: fields.company } : {}),
    ...(fields.items && fields.items.length > 0 ? { items: fields.items } : {}),
    ...(fields.category === 'fuel' && fields.litres
      ? {
          litres: fields.litres,
          pricePerLitre: pricePerLitre(fields.cost, fields.litres),
          // A scanned receipt can't tell us this — assume the common case;
          // the needsReview badge prompts the owner to double-check.
          fullTank: true,
        }
      : {}),
    needsReview: true,
  }
}

async function toJpegBase64(file: File, maxEdge = 1568): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

const MAX_PDF_BYTES = 10 * 1024 * 1024

export async function scanInvoice(file: File): Promise<InvoiceFields> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  let block
  if (isPdf) {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error('That PDF is over 10 MB — export a smaller one or photograph it.')
    }
    block = {
      type: 'document' as const,
      source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: await fileToBase64(file) },
    }
  } else {
    block = {
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: await toJpegBase64(file) },
    }
  }

  const raw = await askAi({
    system: SYSTEM,
    task: 'extract',
    maxTokens: 512,
    messages: [
      {
        role: 'user',
        content: [block, { type: 'text', text: 'Extract the fields from this receipt or invoice.' }],
      },
    ],
  })
  return parseInvoiceJson(raw)
}
