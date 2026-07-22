import { ENTRY_CATEGORIES, type EntryCategory } from '../../db/db'
import type { InvoiceFields } from './invoiceScan'

// Receipts here are Slovak/euro: "1 234,56" not "1234.56", "12.03.2026" not
// ISO. The AI path sidestepped all of this by instructing the model; a
// deterministic parser has to actually handle it, or every total is wrong by
// a factor of 100.

// Space separators OCR emits: normal, non-breaking, thin, narrow-no-break.
const SPACES = /[\s   ]/g

// Amount tokens: digits with optional . or , groupings.
const AMOUNT = /\d{1,3}(?:[.,    ]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/

// threeDecimals: fuel is priced at 1,589 €/l — three decimal places is normal
// there, but "1.234" on a total line means one thousand two hundred and
// thirty-four. Only the caller knows which reading applies.
export function parseAmount(raw: string, threeDecimals = false): number | undefined {
  const cleaned = raw.replace(SPACES, '')
  if (!/^\d[\d.,]*$/.test(cleaned)) return undefined

  const lastDot = cleaned.lastIndexOf('.')
  const lastComma = cleaned.lastIndexOf(',')
  let normalised: string

  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: whichever comes last is the decimal separator
    const decimalAt = Math.max(lastDot, lastComma)
    normalised =
      cleaned.slice(0, decimalAt).replace(/[.,]/g, '') + '.' + cleaned.slice(decimalAt + 1)
  } else if (lastDot >= 0 || lastComma >= 0) {
    const at = Math.max(lastDot, lastComma)
    const after = cleaned.length - at - 1
    // Exactly three trailing digits is a thousands group (1.234); anything
    // else is a decimal fraction (12,50 / 1.5).
    normalised =
      after === 3 && !threeDecimals
        ? cleaned.replace(/[.,]/g, '')
        : cleaned.replace(/[.,]/g, '.')
  } else {
    normalised = cleaned
  }

  const value = Number(normalised)
  return Number.isFinite(value) ? value : undefined
}

const DATE_PATTERNS: { re: RegExp; order: 'dmy' | 'ymd' }[] = [
  { re: /(\d{4})-(\d{2})-(\d{2})/, order: 'ymd' },
  { re: /(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})/, order: 'dmy' },
  { re: /(\d{1,2})\/(\d{1,2})\/(\d{4})/, order: 'dmy' },
]

export function parseDate(text: string): string | undefined {
  for (const { re, order } of DATE_PATTERNS) {
    const match = text.match(re)
    if (!match) continue
    const [a, b, c] = [match[1]!, match[2]!, match[3]!]
    const [year, month, day] = order === 'ymd' ? [a, b, c] : [c, b, a]
    const y = Number(year)
    const m = Number(month)
    const d = Number(day)
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) continue
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return undefined
}

// Anchors for the grand total, most specific first — a receipt often contains
// several amounts (VAT base, VAT, total) and the label is what disambiguates.
const TOTAL_LABELS = [
  'k úhrade',
  'k uhrade',
  'celkom k platbe',
  'spolu k platbe',
  'celkom',
  'celkem',
  'spolu',
  'suma',
  'zaplatené',
  'zaplateno',
  'total',
  'grand total',
]

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function parseTotal(text: string): number | undefined {
  const all = lines(text)

  for (const label of TOTAL_LABELS) {
    for (const line of all) {
      const lower = line.toLowerCase()
      const at = lower.indexOf(label)
      if (at === -1) continue
      // VAT breakdown lines mention a rate; the grand total doesn't
      if (/\bdph\s*\d/.test(lower) || /základ/.test(lower)) continue
      const after = line.slice(at + label.length)
      const match = after.match(new RegExp(AMOUNT.source))
      const value = match ? parseAmount(match[0]) : undefined
      if (value !== undefined && value > 0) return value
    }
  }

  // No label found: the largest amount sitting next to a currency marker is
  // the best remaining guess.
  const candidates: number[] = []
  for (const line of all) {
    if (!/€|eur/i.test(line)) continue
    for (const token of line.match(new RegExp(AMOUNT.source, 'g')) ?? []) {
      const value = parseAmount(token)
      if (value !== undefined && value > 0) candidates.push(value)
    }
  }
  return candidates.length > 0 ? Math.max(...candidates) : undefined
}

export function parseLitres(text: string): number | undefined {
  // "45,30 L" / "45.3 l" / "Litrov: 45,30" — the unit has to be its own token
  // so the "l" inside a word can't match.
  const patterns = [
    new RegExp(`(${AMOUNT.source})\\s*(?:l|L|ltr|Ltr)\\b(?!\\w)`),
    new RegExp(`(?:litr(?:ov|y|u)?|množstvo|mnozstvo)\\D{0,12}(${AMOUNT.source})`, 'i'),
  ]
  for (const re of patterns) {
    const match = text.match(re)
    const value = match ? parseAmount(match[1]!) : undefined
    // A plausible car fill-up, not a price that happened to precede an "l"
    if (value !== undefined && value > 0 && value < 200) return value
  }
  return undefined
}

export function parsePricePerLitre(text: string): number | undefined {
  const patterns = [
    new RegExp(`(${AMOUNT.source})\\s*(?:€|eur)\\s*/\\s*l\\b`, 'i'),
    new RegExp(`(?:cena\\s*(?:za)?\\s*/?\\s*l|jedn\\.?\\s*cena)\\D{0,12}(${AMOUNT.source})`, 'i'),
    new RegExp(`(${AMOUNT.source})\\s*/\\s*l\\b`, 'i'),
  ]
  for (const re of patterns) {
    const match = text.match(re)
    const value = match ? parseAmount(match[1]!, true) : undefined
    if (value !== undefined && value > 0 && value < 20) return value
  }
  return undefined
}

const CATEGORY_KEYWORDS: { category: EntryCategory; words: string[] }[] = [
  {
    category: 'fuel',
    words: [
      'natural 95', 'natural95', 'nafta', 'diesel', 'benzín', 'benzin', 'lpg',
      'slovnaft', 'omv', 'shell', 'mol ', 'orlen', 'jet ', 'čerpacia', 'cerpacia',
      'palivo', 'tankovanie',
    ],
  },
  { category: 'tyres', words: ['pneu', 'pneumatik', 'disky', 'prezutie', 'vyváženie', 'vyvazenie'] },
  {
    category: 'insurance',
    words: ['poistenie', 'poistka', 'pzp', 'havarijné', 'havarijne', 'poistné', 'poistne'],
  },
  {
    category: 'service',
    words: ['servis', 'prehliadka', 'výmena oleja', 'vymena oleja', 'olej', 'filter', 'stk', 'emisná', 'emisna'],
  },
  { category: 'repair', words: ['oprava', 'výmena', 'vymena', 'brzd', 'tlmič', 'tlmic', 'spojk'] },
]

export function parseCategory(text: string): EntryCategory | undefined {
  const lower = text.toLowerCase()
  for (const { category, words } of CATEGORY_KEYWORDS) {
    if (words.some((word) => lower.includes(word))) return category
  }
  return undefined
}

export function parseOdometer(text: string): number | undefined {
  // Only with an explicit label — an unlabelled 6-digit number on a receipt is
  // far more likely to be an invoice number than a mileage reading.
  const match = text.match(
    /(?:stav\s*km|tachometer|najazden\w*|odometer|km\s*stav)\D{0,12}(\d[\d\s .]{2,9})/i,
  )
  if (!match) return undefined
  const value = Number(match[1]!.replace(/[\s .]/g, ''))
  return Number.isFinite(value) && value > 0 && value < 2_000_000 ? value : undefined
}

export interface ParsedReceipt extends InvoiceFields {
  pricePerLitre?: number
}

// If all three of cost, litres and price/litre were read, they must agree.
// A mismatch means at least one is a misread — drop the derived-looking one
// rather than saving a confidently wrong number.
function reconcileFuel(fields: ParsedReceipt): ParsedReceipt {
  const { cost, litres } = fields
  const ppl = fields.pricePerLitre
  if (cost === undefined || litres === undefined || ppl === undefined) return fields
  const expected = litres * ppl
  const tolerance = Math.max(0.05, expected * 0.02)
  if (Math.abs(expected - cost) <= tolerance) return fields
  const { pricePerLitre: _dropped, ...rest } = fields
  return rest
}

export function parseReceiptText(text: string): ParsedReceipt {
  if (!text.trim()) return {}

  const category = parseCategory(text)
  const cost = parseTotal(text)
  const date = parseDate(text)
  const odometer = parseOdometer(text)
  const litres = category === 'fuel' ? parseLitres(text) : undefined
  const pricePerLitre = category === 'fuel' ? parsePricePerLitre(text) : undefined

  const fields: ParsedReceipt = {
    ...(category ? { category } : {}),
    ...(cost !== undefined ? { cost } : {}),
    ...(date ? { date } : {}),
    ...(odometer !== undefined ? { odometer } : {}),
    ...(litres !== undefined ? { litres } : {}),
    ...(pricePerLitre !== undefined ? { pricePerLitre } : {}),
  }
  return reconcileFuel(fields)
}

export const KNOWN_CATEGORIES = ENTRY_CATEGORIES
