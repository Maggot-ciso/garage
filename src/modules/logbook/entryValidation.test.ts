import { describe, expect, it } from 'vitest'
import {
  cleanLineItems,
  odometerWarning,
  pricePerLitre,
  type EntryFormValues,
  validateEntry,
} from './entryValidation'

const valid: EntryFormValues = {
  date: '2026-07-15',
  odometer: '155200',
  cost: '68.50',
  litres: '45.3',
  fullTank: true,
  company: '',
  items: [],
  notes: '',
}

describe('validateEntry', () => {
  it('accepts a valid fuel entry and derives price per litre', () => {
    const result = validateEntry(valid, 'car-1', 'fuel')
    expect(result.errors).toEqual({})
    expect(result.fields).toEqual({
      carId: 'car-1',
      category: 'fuel',
      date: '2026-07-15',
      odometer: 155200,
      cost: 68.5,
      litres: 45.3,
      pricePerLitre: 1.512,
      fullTank: true,
    })
  })

  it('accepts a non-fuel entry and omits fuel fields even when filled', () => {
    const result = validateEntry({ ...valid, notes: 'oil change' }, 'car-1', 'service')
    expect(result.errors).toEqual({})
    expect(result.fields).not.toHaveProperty('litres')
    expect(result.fields).not.toHaveProperty('pricePerLitre')
    expect(result.fields).not.toHaveProperty('fullTank')
    expect(result.fields?.notes).toBe('oil change')
  })

  it('accepts decimal comma input', () => {
    const result = validateEntry({ ...valid, cost: '68,50', litres: '45,3' }, 'car-1', 'fuel')
    expect(result.fields?.cost).toBe(68.5)
    expect(result.fields?.litres).toBe(45.3)
  })

  it('requires litres only for fuel', () => {
    expect(validateEntry({ ...valid, litres: '' }, 'c', 'fuel').errors.litres).toBeDefined()
    expect(validateEntry({ ...valid, litres: '' }, 'c', 'repair').errors.litres).toBeUndefined()
  })

  it('rejects invalid dates', () => {
    expect(validateEntry({ ...valid, date: '' }, 'c', 'fuel').errors.date).toBeDefined()
    expect(validateEntry({ ...valid, date: '15.07.2026' }, 'c', 'fuel').errors.date).toBeDefined()
    expect(validateEntry({ ...valid, date: '2026-13-99' }, 'c', 'fuel').errors.date).toBeDefined()
  })

  it('rejects negative numbers and zero litres', () => {
    expect(validateEntry({ ...valid, odometer: '-1' }, 'c', 'fuel').errors.odometer).toBeDefined()
    expect(validateEntry({ ...valid, cost: '-5' }, 'c', 'fuel').errors.cost).toBeDefined()
    expect(validateEntry({ ...valid, litres: '0' }, 'c', 'fuel').errors.litres).toBeDefined()
  })

  it('allows zero cost (free service, warranty work)', () => {
    expect(validateEntry({ ...valid, cost: '0' }, 'c', 'service').errors.cost).toBeUndefined()
  })
})

describe('pricePerLitre', () => {
  it('rounds to 3 decimals', () => {
    expect(pricePerLitre(68.5, 45.3)).toBe(1.512)
    expect(pricePerLitre(50, 33.333)).toBe(1.5)
  })
})

describe('odometerWarning', () => {
  const history = [
    { date: '2026-05-01', odometer: 150_000 },
    { date: '2026-06-01', odometer: 152_000 },
    { date: '2026-07-01', odometer: 154_000 },
  ]

  it('is silent for a normal next reading', () => {
    expect(odometerWarning({ date: '2026-07-15', odometer: 155_000 }, history)).toBeNull()
  })

  it('is silent when there is no history to compare against', () => {
    expect(odometerWarning({ date: '2026-07-15', odometer: 12 }, [])).toBeNull()
  })

  it('catches a reading that goes backwards', () => {
    const warning = odometerWarning({ date: '2026-07-15', odometer: 153_000 }, history)
    expect(warning).toEqual({
      key: 'odoWarn.lower',
      vars: { km: (154_000).toLocaleString(), date: '2026-07-01' },
    })
  })

  it('catches a backdated entry that exceeds a later one', () => {
    const warning = odometerWarning({ date: '2026-05-15', odometer: 153_000 }, history)
    // Cites the NEAREST later entry (152,000 on 2026-06-01), not a distant one —
    // that is the reading the new entry actually contradicts first
    expect(warning).toEqual({
      key: 'odoWarn.higher',
      vars: { km: (152_000).toLocaleString(), date: '2026-06-01' },
    })
  })

  it('catches the missing-digit typo that inflates the odometer', () => {
    // 1,540,000 instead of 154,000 — this is what breaks every km reminder
    const warning = odometerWarning({ date: '2026-07-15', odometer: 1_540_000 }, history)
    expect(warning?.key).toBe('odoWarn.tooFast')
  })

  it('allows a genuinely long trip', () => {
    // 1,200 km over two days is a real drive, not a typo
    expect(odometerWarning({ date: '2026-07-03', odometer: 155_200 }, history)).toBeNull()
  })

  it('flags an implausible same-day jump', () => {
    expect(odometerWarning({ date: '2026-07-01', odometer: 157_000 }, history)?.key).toBe(
      'odoWarn.tooFast',
    )
  })
})


describe('cleanLineItems', () => {
  it('drops fully blank rows and parses prices', () => {
    expect(
      cleanLineItems([
        { name: 'Oil filter', price: '12.50' },
        { name: '', price: '' },
        { name: 'Labour', price: '40' },
      ]),
    ).toEqual([
      { name: 'Oil filter', price: 12.5 },
      { name: 'Labour', price: 40 },
    ])
  })

  it('accepts a comma decimal and keeps a priced-but-unnamed line', () => {
    expect(cleanLineItems([{ name: 'Brzdové doštičky', price: '54,90' }])).toEqual([
      { name: 'Brzdové doštičky', price: 54.9 },
    ])
    expect(cleanLineItems([{ name: '', price: '9.99' }])).toEqual([{ name: '', price: 9.99 }])
  })

  it('keeps a named line with no price as 0, and negatives (discounts)', () => {
    expect(cleanLineItems([{ name: 'Goodwill', price: '' }])).toEqual([
      { name: 'Goodwill', price: 0 },
    ])
    expect(cleanLineItems([{ name: 'Zľava', price: '-1.84' }])).toEqual([
      { name: 'Zľava', price: -1.84 },
    ])
  })
})

describe('validateEntry — company and items', () => {
  it('carries company and cleaned items onto the saved entry', () => {
    const result = validateEntry(
      {
        ...valid,
        company: '  OMV Slovensko  ',
        items: [
          { name: 'OMV Diesel', price: '18.26' },
          { name: '', price: '' },
        ],
      },
      'car1',
      'fuel',
    )
    expect(result.fields?.company).toBe('OMV Slovensko')
    expect(result.fields?.items).toEqual([{ name: 'OMV Diesel', price: 18.26 }])
  })

  it('omits company and items entirely when empty', () => {
    const result = validateEntry(valid, 'car1', 'fuel')
    expect(result.fields && 'company' in result.fields).toBe(false)
    expect(result.fields && 'items' in result.fields).toBe(false)
  })
})
