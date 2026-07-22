import { askAi } from '../../ai/aiClient'

export interface ReceiptFields {
  date?: string
  cost?: number
  litres?: number
  odometer?: number
}

const SYSTEM = `You extract data from photos of fuel or garage receipts.
Reply with ONLY a JSON object, no markdown fences, with these keys:
"date" (ISO YYYY-MM-DD), "cost" (total amount as number), "litres" (fuel volume as number), "odometer" (km reading as number).
Use null for anything not visible on the receipt. Amounts use dot as decimal separator.`

// Exported separately so the parsing is unit-testable without an API call.
export function parseReceiptJson(raw: string): ReceiptFields {
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
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined)
  const date =
    typeof obj.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.date) ? obj.date : undefined
  return {
    ...(date ? { date } : {}),
    ...(num(obj.cost) !== undefined ? { cost: num(obj.cost) } : {}),
    ...(num(obj.litres) !== undefined ? { litres: num(obj.litres) } : {}),
    ...(num(obj.odometer) !== undefined ? { odometer: num(obj.odometer) } : {}),
  }
}

// Downscale + JPEG-encode so a 12MP phone photo doesn't blow the request size.
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

export async function scanReceipt(file: File): Promise<ReceiptFields> {
  const data = await toJpegBase64(file)
  const raw = await askAi({
    system: SYSTEM,
    task: 'extract',
    maxTokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
          { type: 'text', text: 'Extract the fields from this receipt.' },
        ],
      },
    ],
  })
  return parseReceiptJson(raw)
}
