import type { EntryCategory, LogEntry } from '../../db/db'

export interface EconomyPoint {
  date: string // date of the fill that closes the interval
  lPer100km: number
  distanceKm: number
  litres: number
}

// Fuel economy is only computable between two FULL-tank fills: the tank
// level is known at both ends, and everything poured in between (including
// partial fills) was consumed over that distance.
export function fuelEconomySeries(entries: LogEntry[]): EconomyPoint[] {
  const fills = entries
    .filter((e) => e.category === 'fuel' && e.litres !== undefined)
    .sort((a, b) => a.odometer - b.odometer)

  const points: EconomyPoint[] = []
  let anchor: LogEntry | null = null
  let litresSinceAnchor = 0

  for (const fill of fills) {
    if (anchor) {
      litresSinceAnchor += fill.litres!
      if (fill.fullTank) {
        const distanceKm = fill.odometer - anchor.odometer
        if (distanceKm > 0) {
          points.push({
            date: fill.date,
            lPer100km: Math.round((litresSinceAnchor / distanceKm) * 100 * 100) / 100,
            distanceKm,
            litres: Math.round(litresSinceAnchor * 100) / 100,
          })
        }
      }
    }
    if (fill.fullTank) {
      anchor = fill
      litresSinceAnchor = 0
    }
  }
  return points
}

export interface MonthCost {
  month: string // YYYY-MM
  total: number
}

export function costPerMonth(entries: LogEntry[]): MonthCost[] {
  const totals = new Map<string, number>()
  for (const entry of entries) {
    const month = entry.date.slice(0, 7)
    totals.set(month, (totals.get(month) ?? 0) + entry.cost)
  }
  return [...totals.entries()]
    .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

export interface CategoryCost {
  category: EntryCategory
  total: number
}

export function costByCategory(entries: LogEntry[]): CategoryCost[] {
  const totals = new Map<EntryCategory, number>()
  for (const entry of entries) {
    totals.set(entry.category, (totals.get(entry.category) ?? 0) + entry.cost)
  }
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
}

export function totalCost(entries: LogEntry[]): number {
  return Math.round(entries.reduce((sum, e) => sum + e.cost, 0) * 100) / 100
}

export function averageEconomy(points: EconomyPoint[]): number | null {
  const distance = points.reduce((sum, p) => sum + p.distanceKm, 0)
  const litres = points.reduce((sum, p) => sum + p.litres, 0)
  if (distance <= 0) return null
  return Math.round((litres / distance) * 100 * 100) / 100
}

export interface SpendPerKm {
  distanceKm: number
  all: number // € per km, everything in the logbook
  fuel: number // € per km, fuel only
}

// Distance is what the odometer actually moved across logged entries, so a
// car with one entry (or several at the same reading) yields nothing rather
// than a number divided by zero.
export function spendPerKm(entries: LogEntry[]): SpendPerKm | null {
  if (entries.length < 2) return null
  const odometers = entries.map((e) => e.odometer)
  const distanceKm = Math.max(...odometers) - Math.min(...odometers)
  if (distanceKm <= 0) return null

  const all = entries.reduce((sum, e) => sum + e.cost, 0)
  const fuel = entries.filter((e) => e.category === 'fuel').reduce((sum, e) => sum + e.cost, 0)
  return {
    distanceKm,
    all: Math.round((all / distanceKm) * 1000) / 1000,
    fuel: Math.round((fuel / distanceKm) * 1000) / 1000,
  }
}

export interface PricePoint {
  date: string
  eurPerLitre: number
}

// pricePerLitre is optional on older hand-typed fills — derive it from cost
// and litres when it's missing so the trend doesn't gap.
export function pricePerLitreSeries(entries: LogEntry[]): PricePoint[] {
  return entries
    .filter((e) => e.category === 'fuel' && e.litres !== undefined && e.litres > 0)
    .map((e) => ({
      date: e.date,
      eurPerLitre: Math.round((e.pricePerLitre ?? e.cost / e.litres!) * 1000) / 1000,
    }))
    .filter((p) => p.eurPerLitre > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

// Below these the average is noise, not a projection.
export const PROJECTION_MIN_DAYS = 60
export const PROJECTION_MIN_ENTRIES = 5

export interface YearlyProjection {
  perYear: number
  perMonth: number
  daysObserved: number
  totalSpend: number
}

// Observed days run from the first entry to TODAY, not to the last entry:
// if logging stopped six months ago the projection should sag, not pretend
// the old spending rate still holds.
export function projectedYearlyCost(
  entries: LogEntry[],
  todayISO: string,
): YearlyProjection | null {
  if (entries.length < PROJECTION_MIN_ENTRIES) return null

  const first = entries.reduce((min, e) => (e.date < min ? e.date : min), entries[0]!.date)
  const daysObserved = Math.floor((Date.parse(todayISO) - Date.parse(first)) / 86_400_000)
  if (!Number.isFinite(daysObserved) || daysObserved < PROJECTION_MIN_DAYS) return null

  const totalSpend = entries.reduce((sum, e) => sum + e.cost, 0)
  const perYear = (totalSpend / daysObserved) * 365
  return {
    perYear: Math.round(perYear * 100) / 100,
    perMonth: Math.round((perYear / 12) * 100) / 100,
    daysObserved,
    totalSpend: Math.round(totalSpend * 100) / 100,
  }
}
