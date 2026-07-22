import { describe, expect, it } from 'vitest'
import { cleanItemName, mapReceipt, type EkasaReceipt } from './ekasaMap'

// The real API response for the sample receipt (KarimA s.r.o., a diesel
// fill-up), trimmed to the fields we read.
const dieselReceipt: EkasaReceipt = {
  issueDate: '10.07.2026 16:29:18',
  totalPrice: 58.12,
  organization: { name: 'KarimA s.r.o.' },
  items: [
    { name: '* 4 110305 EFECTA DIESEL                     [A]', itemType: 'K', quantity: 36.92, price: 59.96 },
    { name: 'LOY 10.7. Efecta zľava 0,05€', itemType: 'Z', quantity: 36.92, price: -1.84 },
  ],
}

describe('mapReceipt — fuel', () => {
  it('maps a diesel receipt to a fuel entry with exact litres and cost', () => {
    const { fields, category } = mapReceipt(dieselReceipt)
    expect(category).toBe('fuel')
    expect(fields.category).toBe('fuel')
    expect(fields.date).toBe('2026-07-10')
    expect(fields.cost).toBe(58.12)
    expect(fields.litres).toBe(36.92)
    // 58.12 / 36.92 = 1.5742…
    expect(fields.pricePerLitre).toBe(1.57)
    // The issuer goes to `company`, not stuffed into notes
    expect(fields.company).toBe('KarimA s.r.o.')
    expect(fields.notes).toBeUndefined()
    // Both receipt lines are kept, including the discount, so they reconcile
    expect(fields.items).toEqual([
      { name: 'EFECTA DIESEL', price: 59.96 },
      { name: 'LOY 10.7. Efecta zľava 0,05€', price: -1.84 },
    ])
  })

  it('ignores the discount line and reads the real fuel line', () => {
    // The "Z" discount line also carries quantity 36.92 with a negative price —
    // it must not be mistaken for the fill.
    const { fields } = mapReceipt(dieselReceipt)
    expect(fields.litres).toBe(36.92)
    expect(fields.cost).toBe(58.12) // totalPrice, not the pre-discount item price
  })

  it('matches fuel words case- and diacritic-insensitively (Natural)', () => {
    const r: EkasaReceipt = {
      issueDate: '01.02.2026 08:00:00',
      totalPrice: 40,
      items: [{ name: 'NATURAL 95', quantity: 25, price: 40 }],
    }
    expect(mapReceipt(r).category).toBe('fuel')
    expect(mapReceipt(r).fields.litres).toBe(25)
  })
})

describe('mapReceipt — non-fuel', () => {
  it('maps a service receipt to an "other" entry with shop + items in notes', () => {
    const r: EkasaReceipt = {
      issueDate: '15.03.2026 11:00:00',
      totalPrice: 120.5,
      organization: { name: 'Autoservis Novák' },
      items: [
        { name: 'Výmena oleja', itemType: 'K', quantity: 1, price: 90 },
        { name: 'Olejový filter', itemType: 'K', quantity: 1, price: 30.5 },
      ],
    }
    const { fields, category } = mapReceipt(r)
    expect(category).toBe('other')
    expect(fields.cost).toBe(120.5)
    expect(fields.date).toBe('2026-03-15')
    expect(fields.litres).toBeUndefined()
    expect(fields.company).toBe('Autoservis Novák')
    // Notes stay free for the owner — the work goes in the itemised table
    expect(fields.notes).toBeUndefined()
    expect(fields.items).toEqual([
      { name: 'Výmena oleja', price: 90 },
      { name: 'Olejový filter', price: 30.5 },
    ])
  })

  it('does not treat AdBlue as fuel', () => {
    const r: EkasaReceipt = {
      totalPrice: 12,
      items: [{ name: 'AdBlue 10L', quantity: 10, price: 12 }],
    }
    expect(mapReceipt(r).category).toBe('other')
  })

  it('handles a missing total / items gracefully', () => {
    const { fields, category } = mapReceipt({})
    expect(category).toBe('other')
    expect(fields.cost).toBeUndefined()
    expect(fields.notes).toBeUndefined()
  })
})


describe('cleanItemName', () => {
  it('strips the register noise from an eKasa line', () => {
    expect(cleanItemName('* 4 110305 EFECTA DIESEL                     [A]')).toBe(
      'EFECTA DIESEL',
    )
  })

  it('keeps names that merely start with a digit', () => {
    expect(cleanItemName('5W30 motorový olej')).toBe('5W30 motorový olej')
  })

  it('collapses padding and leaves a plain name alone', () => {
    expect(cleanItemName('  Olejový   filter  ')).toBe('Olejový filter')
  })
})
