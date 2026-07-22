import { describe, expect, it } from 'vitest'
import { emptyQuickFuel, validateQuickFuel } from './quickFuel'

describe('validateQuickFuel', () => {
  it('turns three inputs into a full-tank fuel entry with derived price', () => {
    const { fields, errors } = validateQuickFuel(
      { odometer: '152000', litres: '42,10', cost: '69,55', fullTank: true },
      'c1',
      '2026-07-20',
    )
    expect(errors).toEqual({})
    expect(fields).toEqual({
      carId: 'c1',
      date: '2026-07-20',
      odometer: 152_000,
      cost: 69.55,
      category: 'fuel',
      litres: 42.1,
      pricePerLitre: 1.652, // 69.55 / 42.10
      fullTank: true,
    })
  })

  it('accepts a partial fill when the toggle is off', () => {
    const { fields } = validateQuickFuel(
      { odometer: '152000', litres: '20', cost: '33', fullTank: false },
      'c1',
      '2026-07-20',
    )
    expect(fields?.fullTank).toBe(false)
  })

  it('defaults a fresh form to a full tank', () => {
    expect(emptyQuickFuel().fullTank).toBe(true)
  })

  it('requires all three numbers', () => {
    const { fields, errors } = validateQuickFuel(emptyQuickFuel(), 'c1', '2026-07-20')
    expect(fields).toBeUndefined()
    expect(errors).toEqual({
      odometer: 'Odometer is required',
      litres: 'Litres are required',
      cost: 'Cost is required',
    })
  })

  it('rejects zero or negative litres', () => {
    const { errors } = validateQuickFuel(
      { odometer: '152000', litres: '0', cost: '10', fullTank: true },
      'c1',
      '2026-07-20',
    )
    expect(errors.litres).toBeDefined()
  })
})
