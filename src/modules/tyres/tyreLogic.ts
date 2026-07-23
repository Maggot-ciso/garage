import type { TyreSeason, TyreSet } from '../../db/db'
import type { FieldError } from '../../i18n/fieldError'

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

// Below these the set is worn enough to mention. Advisory only — the app
// never claims to know the legal minimum in the owner's country.
const TREAD_WARN_MM: Record<TyreSeason, number> = {
  summer: 3,
  winter: 4,
  'all-season': 3,
}

export function seasonLabel(season: TyreSeason): string {
  return season === 'all-season' ? 'all-season' : season
}

export function setLabel(set: Pick<TyreSet, 'season' | 'brand' | 'model'>): string {
  const name = [set.brand, set.model].filter(Boolean).join(' ').trim()
  return name || `${seasonLabel(set.season)} set`
}

export function describeSize(set: Pick<TyreSet, 'season' | 'size'>): string {
  return [set.size, seasonLabel(set.season)].filter(Boolean).join(' · ')
}

// The 1st of the next occurrence of swapMonth strictly after afterISO.
// Anchoring to a month (rather than adding 6 months to the completion date)
// is what stops a habitually late swap from drifting out of season.
export function nextSwapDate(swapMonth: number | undefined, afterISO: string): string | null {
  if (swapMonth === undefined || !Number.isInteger(swapMonth) || swapMonth < 1 || swapMonth > 12) {
    return null
  }
  const year = Number(afterISO.slice(0, 4))
  const candidate = (y: number) => `${y}-${String(swapMonth).padStart(2, '0')}-01`
  return candidate(year) > afterISO ? candidate(year) : candidate(year + 1)
}

// Distance covered while this set was on the car. The open period runs to
// the current odometer; a lagging odometer must never produce a negative.
export function kmOnSet(set: Pick<TyreSet, 'fittedPeriods'>, currentOdo: number): number {
  return set.fittedPeriods.reduce((total, period) => {
    const end = period.toOdo ?? currentOdo
    return total + Math.max(0, end - period.fromOdo)
  }, 0)
}

export function latestTread(set: Pick<TyreSet, 'treadReadings'>) {
  return set.treadReadings.reduce<TyreSet['treadReadings'][number] | null>(
    (latest, reading) => (latest === null || reading.date >= latest.date ? reading : latest),
    null,
  )
}

export function treadWarning(
  set: Pick<TyreSet, 'season' | 'treadReadings'>,
): { mm: number; threshold: number } | null {
  const reading = latestTread(set)
  if (reading === null) return null
  const threshold = TREAD_WARN_MM[set.season]
  return reading.mm < threshold ? { mm: reading.mm, threshold } : null
}

export interface TyreFormValues {
  season: TyreSeason
  brand: string
  model: string
  size: string
  swapMonth: string
  purchaseDate: string
  purchaseOdometer: string
  storageLocation: string
  notes: string
}

export type TyreFormErrors = Partial<
  Record<'swapMonth' | 'purchaseDate' | 'purchaseOdometer', FieldError>
>

export interface TyreFormFields {
  season: TyreSeason
  brand?: string
  model?: string
  size?: string
  swapMonth?: number
  purchaseDate?: string
  purchaseOdometer?: number
  storageLocation?: string
  notes?: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function validateTyreSet(values: TyreFormValues): {
  fields?: TyreFormFields
  errors: TyreFormErrors
} {
  const errors: TyreFormErrors = {}

  const swapMonthStr = values.swapMonth.trim()
  const swapMonth = Number(swapMonthStr)
  if (swapMonthStr && (!Number.isInteger(swapMonth) || swapMonth < 1 || swapMonth > 12)) {
    errors.swapMonth = 'validate.pickMonth'
  }

  const purchaseDate = values.purchaseDate.trim()
  if (purchaseDate && (!ISO_DATE.test(purchaseDate) || Number.isNaN(Date.parse(purchaseDate)))) {
    errors.purchaseDate = 'validate.notValidDate'
  }

  const odoStr = values.purchaseOdometer.trim()
  const purchaseOdometer = Number(odoStr)
  if (odoStr && (!Number.isFinite(purchaseOdometer) || purchaseOdometer < 0)) {
    errors.purchaseOdometer = 'validate.mileageMin'
  }

  if (Object.keys(errors).length > 0) return { errors }

  const text = (value: string) => value.trim() || undefined
  return {
    errors,
    fields: {
      season: values.season,
      ...(text(values.brand) ? { brand: values.brand.trim() } : {}),
      ...(text(values.model) ? { model: values.model.trim() } : {}),
      ...(text(values.size) ? { size: values.size.trim() } : {}),
      ...(swapMonthStr ? { swapMonth } : {}),
      ...(purchaseDate ? { purchaseDate } : {}),
      ...(odoStr ? { purchaseOdometer } : {}),
      ...(text(values.storageLocation) ? { storageLocation: values.storageLocation.trim() } : {}),
      ...(text(values.notes) ? { notes: values.notes.trim() } : {}),
    },
  }
}

export type TreadFormErrors = Partial<Record<'date' | 'mm', string>>

export function validateTread(
  date: string,
  mm: string,
): { reading?: { date: string; mm: number }; errors: TreadFormErrors } {
  const errors: TreadFormErrors = {}
  const dateStr = date.trim()
  if (!ISO_DATE.test(dateStr) || Number.isNaN(Date.parse(dateStr))) {
    errors.date = 'validate.notValidDate'
  }
  const value = Number(mm.trim())
  if (!mm.trim() || !Number.isFinite(value) || value <= 0 || value > 25) {
    errors.mm = 'validate.treadRange'
  }
  if (Object.keys(errors).length > 0) return { errors }
  return { errors, reading: { date: dateStr, mm: value } }
}

export function emptyTyreForm(season: TyreSeason = 'summer'): TyreFormValues {
  return {
    season,
    brand: '',
    model: '',
    size: '',
    swapMonth: '',
    purchaseDate: '',
    purchaseOdometer: '',
    storageLocation: '',
    notes: '',
  }
}

export function tyreFormValues(set: TyreSet): TyreFormValues {
  return {
    season: set.season,
    brand: set.brand ?? '',
    model: set.model ?? '',
    size: set.size ?? '',
    swapMonth: set.swapMonth !== undefined ? String(set.swapMonth) : '',
    purchaseDate: set.purchaseDate ?? '',
    purchaseOdometer: set.purchaseOdometer !== undefined ? String(set.purchaseOdometer) : '',
    storageLocation: set.storageLocation ?? '',
    notes: set.notes ?? '',
  }
}
