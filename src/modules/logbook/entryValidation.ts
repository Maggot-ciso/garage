import type { EntryCategory, LineItem } from '../../db/db'
import type { EntryFields } from '../../db/entries'

// Prices stay strings while editing so a half-typed "12," isn't clobbered.
export interface LineItemInput {
  name: string
  price: string
}

export interface EntryFormValues {
  date: string
  odometer: string
  cost: string
  litres: string
  fullTank: boolean
  company: string
  items: LineItemInput[]
  notes: string
}

// Drop blank rows and parse prices. A row with a name but no price is kept at 0
// (a line worth recording that the receipt didn't price); a row with neither is
// dropped entirely, so trailing empty inputs never reach the database.
export function cleanLineItems(items: LineItemInput[]): LineItem[] {
  return items
    .map((i) => ({ name: i.name.trim(), price: i.price.trim() }))
    .filter((i) => i.name !== '' || i.price !== '')
    .map((i) => {
      const price = Number(i.price.replace(',', '.'))
      return { name: i.name, price: Number.isFinite(price) ? roundMoney(price) : 0 }
    })
}

export type EntryFormErrors = Partial<Record<'date' | 'odometer' | 'cost' | 'litres', string>>

export interface EntryValidationResult {
  fields?: EntryFields
  errors: EntryFormErrors
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function pricePerLitre(cost: number, litres: number): number {
  // 3 decimals — fuel is priced in tenths of a cent
  return Math.round((cost / litres) * 1000) / 1000
}

export function validateEntry(
  values: EntryFormValues,
  carId: string,
  category: EntryCategory,
): EntryValidationResult {
  const errors: EntryFormErrors = {}
  const isFuel = category === 'fuel'

  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || Number.isNaN(Date.parse(values.date))) {
    errors.date = 'A valid date is required'
  }

  const odometer = Number(values.odometer.trim())
  if (!values.odometer.trim()) {
    errors.odometer = 'Odometer is required'
  } else if (!Number.isFinite(odometer) || odometer < 0) {
    errors.odometer = 'Odometer must be 0 or more'
  }

  const cost = Number(values.cost.trim().replace(',', '.'))
  if (!values.cost.trim()) {
    errors.cost = 'Cost is required'
  } else if (!Number.isFinite(cost) || cost < 0) {
    errors.cost = 'Cost must be 0 or more'
  }

  const litres = Number(values.litres.trim().replace(',', '.'))
  if (isFuel) {
    if (!values.litres.trim()) {
      errors.litres = 'Litres are required for fuel'
    } else if (!Number.isFinite(litres) || litres <= 0) {
      errors.litres = 'Litres must be more than 0'
    }
  }

  if (Object.keys(errors).length > 0) return { errors }

  const notes = values.notes.trim()
  const company = values.company.trim()
  const items = cleanLineItems(values.items)
  return {
    errors,
    fields: {
      carId,
      category,
      date: values.date,
      odometer,
      cost: roundMoney(cost),
      ...(notes ? { notes } : {}),
      ...(company ? { company } : {}),
      ...(items.length > 0 ? { items } : {}),
      ...(isFuel
        ? {
            litres,
            pricePerLitre: pricePerLitre(cost, litres),
            fullTank: values.fullTank,
          }
        : {}),
    },
  }
}

// An odometer typo is silently corrosive: currentOdometer() takes the MAX across
// entries, so one extra digit marks every km-based reminder due forever, and
// fuelEconomySeries() sorts fills by odometer, so an out-of-order value scrambles
// the full-to-full intervals into nonsense. Worth catching at entry time.
//
// A warning, never a block — odometers do legitimately get replaced, and a
// backdated entry is a normal thing to add.

/** Beyond this the reading is almost certainly a typo, not a road trip. */
const MAX_KM_PER_DAY = 1500
const MAX_SAME_DAY_KM = 2000

export interface OdometerContext {
  date: string
  odometer: number
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}

export function odometerWarning(
  candidate: OdometerContext,
  existing: OdometerContext[],
): string | null {
  if (!Number.isFinite(candidate.odometer) || existing.length === 0) return null

  const earlier = existing
    .filter((e) => e.date <= candidate.date)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  const later = existing
    .filter((e) => e.date > candidate.date)
    .sort((a, b) => a.date.localeCompare(b.date))[0]

  if (earlier && candidate.odometer < earlier.odometer) {
    return `Lower than the ${earlier.odometer.toLocaleString()} km logged on ${earlier.date}.`
  }
  if (later && candidate.odometer > later.odometer) {
    return `Higher than the ${later.odometer.toLocaleString()} km logged later, on ${later.date}.`
  }

  if (earlier) {
    const gap = candidate.odometer - earlier.odometer
    const days = daysBetween(earlier.date, candidate.date)
    const tooFast = days > 0 ? gap / days > MAX_KM_PER_DAY : gap > MAX_SAME_DAY_KM
    if (tooFast) {
      return `That's ${gap.toLocaleString()} km since ${earlier.date} — check for a typo.`
    }
  }
  return null
}
