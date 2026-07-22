import { describe, expect, it } from 'vitest'
import type { LogEntry } from '../../db/db'
import {
  averageEconomy,
  costByCategory,
  costPerMonth,
  fuelEconomySeries,
  pricePerLitreSeries,
  projectedYearlyCost,
  spendPerKm,
  totalCost,
} from './calculations'

let counter = 0
function entry(overrides: Partial<LogEntry>): LogEntry {
  counter += 1
  return {
    id: `e${counter}`,
    carId: 'car-1',
    category: 'fuel',
    date: '2026-01-01',
    odometer: 100000,
    cost: 50,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function fill(odometer: number, litres: number, fullTank: boolean, date = '2026-01-01'): LogEntry {
  return entry({ odometer, litres, fullTank, date, pricePerLitre: 1.5, cost: litres * 1.5 })
}

describe('fuelEconomySeries', () => {
  it('computes economy between consecutive full fills', () => {
    const points = fuelEconomySeries([
      fill(100000, 40, true, '2026-01-01'),
      fill(100600, 42, true, '2026-01-20'),
    ])
    expect(points).toEqual([{ date: '2026-01-20', lPer100km: 7, distanceKm: 600, litres: 42 }])
  })

  it('sums partial fills into the next full-to-full interval', () => {
    const points = fuelEconomySeries([
      fill(100000, 40, true),
      fill(100300, 20, false),
      fill(100600, 22, true, '2026-02-01'),
    ])
    expect(points).toEqual([
      { date: '2026-02-01', lPer100km: 7, distanceKm: 600, litres: 42 },
    ])
  })

  it('a partial fill before any full fill is ignored', () => {
    const points = fuelEconomySeries([
      fill(100000, 15, false),
      fill(100200, 40, true),
      fill(100800, 42, true),
    ])
    expect(points).toHaveLength(1)
    expect(points[0]!.distanceKm).toBe(600)
  })

  it('sorts by odometer regardless of input order', () => {
    const points = fuelEconomySeries([fill(100600, 42, true), fill(100000, 40, true)])
    expect(points).toHaveLength(1)
    expect(points[0]!.lPer100km).toBe(7)
  })

  it('returns empty with fewer than two full fills', () => {
    expect(fuelEconomySeries([fill(100000, 40, true)])).toEqual([])
    expect(fuelEconomySeries([fill(100000, 40, false), fill(100300, 20, false)])).toEqual([])
  })

  it('skips zero-distance intervals and ignores non-fuel entries', () => {
    const points = fuelEconomySeries([
      fill(100000, 40, true),
      fill(100000, 5, true),
      entry({ category: 'service', odometer: 100100 }),
      fill(100500, 35, true),
    ])
    // 100000->100000 skipped; anchor moves to the second fill at 100000
    expect(points).toEqual([
      { date: '2026-01-01', lPer100km: 7, distanceKm: 500, litres: 35 },
    ])
  })
})

describe('cost aggregation', () => {
  const entries = [
    entry({ date: '2026-01-05', cost: 50, category: 'fuel' }),
    entry({ date: '2026-01-25', cost: 30.5, category: 'fuel' }),
    entry({ date: '2026-02-10', cost: 200, category: 'service' }),
    entry({ date: '2025-12-31', cost: 10, category: 'other' }),
  ]

  it('groups cost per month in chronological order', () => {
    expect(costPerMonth(entries)).toEqual([
      { month: '2025-12', total: 10 },
      { month: '2026-01', total: 80.5 },
      { month: '2026-02', total: 200 },
    ])
  })

  it('groups cost by category, largest first', () => {
    expect(costByCategory(entries)).toEqual([
      { category: 'service', total: 200 },
      { category: 'fuel', total: 80.5 },
      { category: 'other', total: 10 },
    ])
  })

  it('totals all costs without float drift', () => {
    expect(totalCost(entries)).toBe(290.5)
    expect(totalCost([entry({ cost: 0.1 }), entry({ cost: 0.2 })])).toBe(0.3)
  })
})

describe('averageEconomy', () => {
  it('weights by distance, not by point', () => {
    expect(
      averageEconomy([
        { date: 'a', lPer100km: 10, distanceKm: 100, litres: 10 },
        { date: 'b', lPer100km: 5, distanceKm: 900, litres: 45 },
      ]),
    ).toBe(5.5)
  })

  it('returns null with no data', () => {
    expect(averageEconomy([])).toBeNull()
  })
})

describe('spendPerKm', () => {
  it('divides spend by the distance the odometer actually moved', () => {
    const entries = [
      entry({ odometer: 100_000, cost: 60, category: 'fuel' }),
      entry({ odometer: 105_000, cost: 40, category: 'fuel' }),
      entry({ odometer: 110_000, cost: 300, category: 'repair' }),
    ]
    const result = spendPerKm(entries)!
    expect(result.distanceKm).toBe(10_000)
    expect(result.all).toBe(0.04) // 400 / 10000
    expect(result.fuel).toBe(0.01) // 100 / 10000
  })

  it('is null without enough to measure a distance', () => {
    expect(spendPerKm([])).toBeNull()
    expect(spendPerKm([entry({ odometer: 100_000 })])).toBeNull()
    expect(
      spendPerKm([entry({ odometer: 100_000 }), entry({ odometer: 100_000 })]),
    ).toBeNull()
  })

  it('reports zero fuel cost per km for a car with no fuel entries', () => {
    const result = spendPerKm([
      entry({ odometer: 100_000, cost: 200, category: 'service' }),
      entry({ odometer: 102_000, cost: 200, category: 'insurance' }),
    ])!
    expect(result.fuel).toBe(0)
    expect(result.all).toBe(0.2)
  })
})

describe('pricePerLitreSeries', () => {
  it('uses the recorded price per litre', () => {
    const series = pricePerLitreSeries([
      entry({ date: '2026-03-01', litres: 40, pricePerLitre: 1.62, cost: 64.8 }),
    ])
    expect(series).toEqual([{ date: '2026-03-01', eurPerLitre: 1.62 }])
  })

  it('derives the price when only cost and litres were entered', () => {
    const series = pricePerLitreSeries([
      entry({ date: '2026-03-01', litres: 40, cost: 60, pricePerLitre: undefined }),
    ])
    expect(series).toEqual([{ date: '2026-03-01', eurPerLitre: 1.5 }])
  })

  it('sorts by date and ignores non-fuel and litre-less entries', () => {
    const series = pricePerLitreSeries([
      entry({ date: '2026-05-01', litres: 30, pricePerLitre: 1.7 }),
      entry({ date: '2026-01-01', litres: 30, pricePerLitre: 1.4 }),
      entry({ date: '2026-02-01', category: 'repair', cost: 300 }),
      entry({ date: '2026-03-01', litres: undefined }),
      entry({ date: '2026-04-01', litres: 0, cost: 0 }),
    ])
    expect(series.map((p) => p.date)).toEqual(['2026-01-01', '2026-05-01'])
  })
})

describe('projectedYearlyCost', () => {
  const spread = (count: number, cost: number, startDate: string) =>
    Array.from({ length: count }, (_, i) =>
      entry({ date: `${startDate.slice(0, 8)}${String(i + 1).padStart(2, '0')}`, cost }),
    )

  it('scales observed spend up to a full year', () => {
    // 5 entries × 100 € = 500 € over exactly 100 days
    const entries = spread(5, 100, '2026-01-01')
    const result = projectedYearlyCost(entries, '2026-04-11')!
    expect(result.daysObserved).toBe(100)
    expect(result.totalSpend).toBe(500)
    expect(result.perYear).toBe(1825) // 500 / 100 * 365
    expect(result.perMonth).toBe(152.08)
  })

  it('measures to today, so a stale logbook sags instead of pretending', () => {
    const entries = spread(5, 100, '2026-01-01')
    const fresh = projectedYearlyCost(entries, '2026-04-11')!
    const stale = projectedYearlyCost(entries, '2027-04-11')!
    expect(stale.perYear).toBeLessThan(fresh.perYear)
  })

  it('is null below the minimum entry count', () => {
    expect(projectedYearlyCost(spread(4, 100, '2026-01-01'), '2026-06-01')).toBeNull()
  })

  it('is null below the minimum observation window', () => {
    expect(projectedYearlyCost(spread(5, 100, '2026-01-01'), '2026-02-15')).toBeNull()
  })
})
