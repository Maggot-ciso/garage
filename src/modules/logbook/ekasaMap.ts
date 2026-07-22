import type { EntryCategory, LineItem } from '../../db/db'
import type { ParsedReceipt } from './receiptParse'

// The slice of the eKasa /opd/receipt/find response we use. The API returns
// much more (VAT breakdown, PKP/OKP, unit address); we only need what maps onto
// a logbook entry.
export interface EkasaItem {
  name: string
  itemType?: string // "K" normal, "Z" discount (zľava), etc.
  quantity: number
  price: number
}

export interface EkasaReceipt {
  issueDate?: string // "DD.MM.YYYY hh:mm:ss"
  totalPrice?: number
  items?: EkasaItem[]
  organization?: { name?: string | null }
}

// Fuel line detection: generic Slovak/English fuel words, diacritic-insensitive.
// Brand names are deliberately excluded — "EFECTA DIESEL" still matches on
// "diesel", so we don't need to chase every station's product naming.
const FUEL_WORDS = ['nafta', 'diesel', 'benzin', 'natural', 'gazoil', 'lpg', 'adblue']

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
}

function looksLikeFuel(name: string): boolean {
  const n = normalize(name)
  // AdBlue is sold at pumps but isn't fuel — never treat it as the fuel line.
  if (n.includes('adblue')) return false
  return FUEL_WORDS.some((w) => w !== 'adblue' && n.includes(w))
}

// "10.07.2026 16:29:18" → "2026-07-10". Returns undefined if unparseable.
function toIsoDate(issueDate: string | undefined): string | undefined {
  if (!issueDate) return undefined
  const m = issueDate.match(/^(\d{2})\.(\d{2})\.(\d{4})/)
  if (!m) return undefined
  const [, dd, mm, yyyy] = m
  return `${yyyy}-${mm}-${dd}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// eKasa item names carry register noise: a leading "*" marker, PLU/article
// numbers, padding spaces and a trailing VAT-class tag, e.g.
//   "* 4 110305 EFECTA DIESEL                     [A]"  ->  "EFECTA DIESEL"
// Only wholly-numeric leading tokens are dropped, so "5W30 oil" survives intact.
export function cleanItemName(raw: string): string {
  let name = raw.replace(/\s+/g, ' ').trim()
  name = name.replace(/\s*\[[A-Za-z0-9]{1,2}\]$/, '')
  name = name.replace(/^\*\s*/, '')
  name = name.replace(/^(?:\d+\s+)+/, '')
  return name.trim()
}

// The receipt's own breakdown, kept in order. Discount lines are included on
// purpose: without them the rows don't add up to the total the shop charged.
function toLineItems(items: EkasaItem[]): LineItem[] {
  return items
    .map((i) => ({ name: cleanItemName(i.name), price: round2(i.price) }))
    .filter((i) => i.name !== '')
}

// eKasa receipt → prefill fields for the entry form. Fuel receipts become a fuel
// entry with exact litres/cost/€-per-litre; everything else becomes an 'other'
// entry (the user retags it) with the shop and items in the notes. Nothing here
// touches the DB — the caller opens the form prefilled and the user confirms.
export function mapReceipt(receipt: EkasaReceipt): {
  fields: ParsedReceipt
  category: EntryCategory
} {
  const items = receipt.items ?? []
  const shop = receipt.organization?.name?.trim() || undefined
  const date = toIsoDate(receipt.issueDate)
  const cost = receipt.totalPrice !== undefined ? round2(receipt.totalPrice) : undefined

  // Prefer a normal (non-discount) fuel line; discount lines ("Z") copy the
  // litre quantity with a negative price and must not be read as the fill.
  const fuelItem =
    items.find((i) => i.itemType !== 'Z' && i.quantity > 0 && looksLikeFuel(i.name)) ??
    items.find((i) => i.quantity > 0 && looksLikeFuel(i.name))

  if (fuelItem) {
    const litres = round2(fuelItem.quantity)
    const fields: ParsedReceipt = {
      category: 'fuel',
      ...(date ? { date } : {}),
      ...(cost !== undefined ? { cost } : {}),
      ...(litres > 0 ? { litres } : {}),
      ...(cost !== undefined && litres > 0
        ? { pricePerLitre: round2(cost / litres) }
        : {}),
      ...(shop ? { company: shop } : {}),
      ...(items.length > 0 ? { items: toLineItems(items) } : {}),
    }
    return { fields, category: 'fuel' }
  }

  // Non-fuel: the receipt's lines become the entry's itemised table, and the
  // issuer becomes the company. Notes stay free for the owner's own remarks
  // rather than being stuffed with everything that was done.
  const fields: ParsedReceipt = {
    category: 'other',
    ...(date ? { date } : {}),
    ...(cost !== undefined ? { cost } : {}),
    ...(shop ? { company: shop } : {}),
    ...(items.length > 0 ? { items: toLineItems(items) } : {}),
  }
  return { fields, category: 'other' }
}
