import { describe, expect, it } from 'vitest'
import type { TyreSet } from '../../db/db'
import {
  emptyTyreForm,
  kmOnSet,
  latestTread,
  nextSwapDate,
  setLabel,
  treadWarning,
  validateTread,
  validateTyreSet,
} from './tyreLogic'

function makeSet(overrides: Partial<TyreSet> = {}): TyreSet {
  return {
    id: 't1',
    carId: 'c1',
    season: 'summer',
    status: 'stored',
    treadReadings: [],
    fittedPeriods: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('nextSwapDate', () => {
  it('picks this year when the month is still ahead', () => {
    expect(nextSwapDate(10, '2026-09-20')).toBe('2026-10-01')
  })

  it('rolls to next year once the month has started', () => {
    expect(nextSwapDate(10, '2026-10-01')).toBe('2027-10-01')
    expect(nextSwapDate(10, '2026-10-14')).toBe('2027-10-01')
  })

  it('keeps a late swap anchored to the same month next year', () => {
    // Swap done three weeks late — next one must still be October, not November
    expect(nextSwapDate(10, '2026-10-22')).toBe('2027-10-01')
  })

  it('wraps December to January', () => {
    expect(nextSwapDate(1, '2026-12-15')).toBe('2027-01-01')
  })

  it('returns null without a usable month', () => {
    expect(nextSwapDate(undefined, '2026-05-01')).toBeNull()
    expect(nextSwapDate(0, '2026-05-01')).toBeNull()
    expect(nextSwapDate(13, '2026-05-01')).toBeNull()
    expect(nextSwapDate(6.5, '2026-05-01')).toBeNull()
  })
})

describe('kmOnSet', () => {
  it('is zero with no fitted periods', () => {
    expect(kmOnSet(makeSet(), 100_000)).toBe(0)
  })

  it('runs an open period up to the current odometer', () => {
    const set = makeSet({ fittedPeriods: [{ fromDate: '2026-04-01', fromOdo: 130_000 }] })
    expect(kmOnSet(set, 148_200)).toBe(18_200)
  })

  it('sums several seasons on and off the car', () => {
    const set = makeSet({
      fittedPeriods: [
        { fromDate: '2024-04-01', fromOdo: 100_000, toDate: '2024-10-01', toOdo: 108_000 },
        { fromDate: '2025-04-01', fromOdo: 115_000, toDate: '2025-10-01', toOdo: 122_000 },
        { fromDate: '2026-04-01', fromOdo: 130_000 },
      ],
    })
    expect(kmOnSet(set, 134_500)).toBe(8_000 + 7_000 + 4_500)
  })

  it('never goes negative when the odometer lags behind', () => {
    const set = makeSet({ fittedPeriods: [{ fromDate: '2026-04-01', fromOdo: 130_000 }] })
    expect(kmOnSet(set, 129_000)).toBe(0)
  })
})

describe('latestTread', () => {
  it('is null with no readings', () => {
    expect(latestTread(makeSet())).toBeNull()
  })

  it('picks the newest reading regardless of insertion order', () => {
    const set = makeSet({
      treadReadings: [
        { date: '2026-04-01', mm: 6.5 },
        { date: '2026-10-01', mm: 5.1 },
        { date: '2025-04-01', mm: 7.8 },
      ],
    })
    expect(latestTread(set)).toEqual({ date: '2026-10-01', mm: 5.1 })
  })
})

describe('treadWarning', () => {
  it('is null without readings', () => {
    expect(treadWarning(makeSet())).toBeNull()
  })

  it('stays quiet above the threshold', () => {
    expect(treadWarning(makeSet({ treadReadings: [{ date: '2026-05-01', mm: 5 }] }))).toBeNull()
  })

  it('warns below 3 mm on summer tyres', () => {
    const set = makeSet({ treadReadings: [{ date: '2026-05-01', mm: 2.5 }] })
    expect(treadWarning(set)).toEqual({ mm: 2.5, threshold: 3 })
  })

  it('holds winter tyres to a higher threshold', () => {
    const set = makeSet({ season: 'winter', treadReadings: [{ date: '2026-05-01', mm: 3.5 }] })
    expect(treadWarning(set)).toEqual({ mm: 3.5, threshold: 4 })
  })
})

describe('setLabel', () => {
  it('uses brand and model when known', () => {
    expect(setLabel({ season: 'summer', brand: 'Michelin', model: 'Pilot Sport 4' })).toBe(
      'Michelin Pilot Sport 4',
    )
  })

  it('falls back to the season', () => {
    expect(setLabel({ season: 'winter' })).toBe('winter set')
    expect(setLabel({ season: 'all-season' })).toBe('all-season set')
  })
})

describe('validateTyreSet', () => {
  it('accepts a bare set with only a season', () => {
    const { fields, errors } = validateTyreSet(emptyTyreForm('winter'))
    expect(errors).toEqual({})
    expect(fields).toEqual({ season: 'winter' })
  })

  it('trims text and converts numbers', () => {
    const { fields } = validateTyreSet({
      ...emptyTyreForm(),
      brand: '  Michelin ',
      size: ' 225/40 R19 ',
      swapMonth: '4',
      purchaseOdometer: '130000',
      storageLocation: ' Cellar, rack B ',
    })
    expect(fields).toMatchObject({
      brand: 'Michelin',
      size: '225/40 R19',
      swapMonth: 4,
      purchaseOdometer: 130_000,
      storageLocation: 'Cellar, rack B',
    })
  })

  it('rejects an impossible month and a bad date', () => {
    const { fields, errors } = validateTyreSet({
      ...emptyTyreForm(),
      swapMonth: '13',
      purchaseDate: 'last spring',
    })
    expect(fields).toBeUndefined()
    expect(errors.swapMonth).toBeDefined()
    expect(errors.purchaseDate).toBeDefined()
  })

  it('rejects a negative purchase odometer', () => {
    const { errors } = validateTyreSet({ ...emptyTyreForm(), purchaseOdometer: '-5' })
    expect(errors.purchaseOdometer).toBeDefined()
  })
})

describe('validateTread', () => {
  it('accepts a plausible reading', () => {
    expect(validateTread('2026-07-19', '5.5').reading).toEqual({ date: '2026-07-19', mm: 5.5 })
  })

  it('rejects nonsense', () => {
    expect(validateTread('2026-07-19', '0').errors.mm).toBeDefined()
    expect(validateTread('2026-07-19', '').errors.mm).toBeDefined()
    expect(validateTread('2026-07-19', '99').errors.mm).toBeDefined()
    expect(validateTread('nope', '5').errors.date).toBeDefined()
  })
})
