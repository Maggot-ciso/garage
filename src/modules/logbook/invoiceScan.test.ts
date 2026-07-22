import { describe, expect, it } from 'vitest'
import { parseInvoiceJson, toAutoEntry } from './invoiceScan'

describe('parseInvoiceJson', () => {
  it('parses a full invoice with category and notes', () => {
    expect(
      parseInvoiceJson(
        '{"category":"service","date":"2026-07-10","cost":230.5,"litres":null,"odometer":155400,"notes":"AutoServis BA — oil + filters"}',
      ),
    ).toEqual({
      category: 'service',
      date: '2026-07-10',
      cost: 230.5,
      odometer: 155400,
      notes: 'AutoServis BA — oil + filters',
    })
  })

  it('drops unknown categories and malformed values', () => {
    expect(
      parseInvoiceJson('{"category":"groceries","date":"10.7.2026","cost":-3,"litres":"many"}'),
    ).toEqual({})
  })

  it('tolerates fences and surrounding prose', () => {
    expect(parseInvoiceJson('Sure!\n```json\n{"category":"fuel","cost":68.5}\n```')).toEqual({
      category: 'fuel',
      cost: 68.5,
    })
  })
})

describe('toAutoEntry', () => {
  const fuel = { category: 'fuel' as const, date: '2026-07-15', cost: 68.5, litres: 45.3 }

  it('builds an auto-save entry flagged for review', () => {
    const entry = toAutoEntry(fuel, 'car-1', 155000)
    expect(entry).toMatchObject({
      carId: 'car-1',
      category: 'fuel',
      cost: 68.5,
      litres: 45.3,
      pricePerLitre: 1.512,
      fullTank: true,
      odometer: 155000, // fallback used — receipt had none
      needsReview: true,
    })
  })

  it('prefers the odometer read from the invoice', () => {
    expect(toAutoEntry({ ...fuel, odometer: 155700 }, 'c', 155000)?.odometer).toBe(155700)
  })

  it('refuses when essentials are missing (falls back to the form)', () => {
    expect(toAutoEntry({ ...fuel, date: undefined }, 'c', 0)).toBeNull()
    expect(toAutoEntry({ ...fuel, cost: undefined }, 'c', 0)).toBeNull()
    expect(toAutoEntry({ ...fuel, category: undefined }, 'c', 0)).toBeNull()
    expect(toAutoEntry({ ...fuel, litres: undefined }, 'c', 0)).toBeNull() // fuel needs litres
  })

  it('non-fuel entries do not need litres', () => {
    const entry = toAutoEntry(
      { category: 'repair', date: '2026-07-01', cost: 120 },
      'c',
      155000,
    )
    expect(entry).toMatchObject({ category: 'repair', cost: 120, needsReview: true })
    expect(entry).not.toHaveProperty('litres')
  })
})
