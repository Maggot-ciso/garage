import { describe, expect, it } from 'vitest'
import {
  parseAmount,
  parseCategory,
  parseDate,
  parseLitres,
  parseOdometer,
  parsePricePerLitre,
  parseReceiptText,
  parseTotal,
} from './receiptParse'

const FUEL_RECEIPT = `SLOVNAFT a.s.
Čerpacia stanica Bratislava Petržalka
Dátum: 12.03.2026  14:32
Natural 95
Množstvo: 45,30 L
Cena/l: 1,589 €/l
Spolu: 71,98 €
DPH 20%: 11,99`

const GARAGE_INVOICE = `AUTOSERVIS NOVAK s.r.o.
Faktúra č. 2026/0451
Dátum vystavenia: 03.02.2026
Výmena oleja a filtra, prehliadka
Základ dane: 1 028,33
DPH 20%: 205,67
Celkom k platbe: 1 234,00 €`

const TYRE_RECEIPT = `PNEUSERVIS RÝCHLY
Prezutie + vyváženie kolies
Dátum: 15.10.2025
Spolu 89,50 EUR`

const INSURANCE = `Povinné zmluvné poistenie (PZP)
Poistné obdobie 2026
Dátum: 01.01.2026
K úhrade: 245,00 €`

describe('parseAmount', () => {
  it('reads Slovak decimal commas', () => {
    expect(parseAmount('71,98')).toBe(71.98)
    expect(parseAmount('45,30')).toBe(45.3)
  })

  it('reads space-separated thousands', () => {
    expect(parseAmount('1 234,56')).toBe(1234.56)
    expect(parseAmount('1 234,56')).toBe(1234.56) // non-breaking space
  })

  it('reads dot-separated thousands with comma decimals', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56)
  })

  it('still reads plain dot decimals', () => {
    expect(parseAmount('1234.56')).toBe(1234.56)
    expect(parseAmount('1.5')).toBe(1.5)
  })

  it('treats a lone three-digit group as thousands by default', () => {
    expect(parseAmount('1.234')).toBe(1234)
    expect(parseAmount('1,234')).toBe(1234)
  })

  it('treats three digits as decimals when the caller says so', () => {
    // Fuel is priced at 1,589 €/l — not one thousand five hundred euros
    expect(parseAmount('1,589', true)).toBe(1.589)
  })

  it('rejects non-numeric input', () => {
    expect(parseAmount('abc')).toBeUndefined()
    expect(parseAmount('')).toBeUndefined()
  })
})

describe('parseDate', () => {
  it('reads Slovak DD.MM.YYYY', () => {
    expect(parseDate('Dátum: 12.03.2026 14:32')).toBe('2026-03-12')
    expect(parseDate('3.2.2026')).toBe('2026-02-03')
    expect(parseDate('12. 03. 2026')).toBe('2026-03-12')
  })

  it('reads ISO dates', () => {
    expect(parseDate('2026-03-12')).toBe('2026-03-12')
  })

  it('rejects impossible dates', () => {
    expect(parseDate('45.99.2026')).toBeUndefined()
    expect(parseDate('no date here')).toBeUndefined()
  })
})

describe('parseTotal', () => {
  it('picks the labelled grand total, not the VAT or the base', () => {
    expect(parseTotal(GARAGE_INVOICE)).toBe(1234)
  })

  it('reads a simple total line', () => {
    expect(parseTotal(FUEL_RECEIPT)).toBe(71.98)
    expect(parseTotal(TYRE_RECEIPT)).toBe(89.5)
  })

  it('handles "k úhrade"', () => {
    expect(parseTotal(INSURANCE)).toBe(245)
  })

  it('falls back to the largest amount beside a currency marker', () => {
    expect(parseTotal('Nejaký účet\n12,00 €\n48,60 €\n3,50 €')).toBe(48.6)
  })

  it('is undefined when there is nothing to read', () => {
    expect(parseTotal('bez sumy')).toBeUndefined()
  })
})

describe('parseLitres and parsePricePerLitre', () => {
  it('reads litres and a three-decimal price', () => {
    expect(parseLitres(FUEL_RECEIPT)).toBe(45.3)
    expect(parsePricePerLitre(FUEL_RECEIPT)).toBe(1.589)
  })

  it('ignores an implausible litre count', () => {
    expect(parseLitres('Faktúra 4500 l')).toBeUndefined()
  })

  it('does not match an "l" inside a word', () => {
    expect(parseLitres('Celkom 45,30 lorem ipsum')).toBeUndefined()
  })
})

describe('parseCategory', () => {
  it('classifies by vendor and item keywords', () => {
    expect(parseCategory(FUEL_RECEIPT)).toBe('fuel')
    expect(parseCategory(GARAGE_INVOICE)).toBe('service')
    expect(parseCategory(TYRE_RECEIPT)).toBe('tyres')
    expect(parseCategory(INSURANCE)).toBe('insurance')
  })

  it('is undefined when nothing matches', () => {
    expect(parseCategory('Ďakujeme za návštevu')).toBeUndefined()
  })
})

describe('parseOdometer', () => {
  it('reads a labelled mileage', () => {
    expect(parseOdometer('Stav km: 152 480')).toBe(152480)
  })

  it('ignores unlabelled long numbers', () => {
    // An invoice number must never be mistaken for a mileage reading
    expect(parseOdometer('Faktúra č. 2026045123')).toBeUndefined()
  })
})

describe('parseReceiptText', () => {
  it('extracts a full fuel receipt', () => {
    expect(parseReceiptText(FUEL_RECEIPT)).toEqual({
      category: 'fuel',
      date: '2026-03-12',
      cost: 71.98,
      litres: 45.3,
      pricePerLitre: 1.589,
    })
  })

  it('extracts a garage invoice', () => {
    expect(parseReceiptText(GARAGE_INVOICE)).toEqual({
      category: 'service',
      date: '2026-02-03',
      cost: 1234,
    })
  })

  it('drops the price per litre when the three numbers disagree', () => {
    const inconsistent = `OMV
Dátum: 01.02.2026
Natural 95
40,00 L
2,000 €/l
Spolu: 12,00 €`
    const parsed = parseReceiptText(inconsistent)
    // 40 × 2.00 = 80, not 12 — one of them is a misread, so don't assert it
    expect(parsed.pricePerLitre).toBeUndefined()
    expect(parsed.cost).toBe(12)
  })

  it('keeps all three when they reconcile', () => {
    expect(parseReceiptText(FUEL_RECEIPT).pricePerLitre).toBe(1.589)
  })

  it('returns nothing for empty or useless text', () => {
    expect(parseReceiptText('')).toEqual({})
    expect(parseReceiptText('   \n  ')).toEqual({})
  })

  it('never invents litres for a non-fuel receipt', () => {
    expect(parseReceiptText(TYRE_RECEIPT).litres).toBeUndefined()
  })
})
