import { describe, expect, it } from 'vitest'
import type { Car, LogEntry } from '../../db/db'
import { buildServiceHistory, historyToHtml, historyToText } from './serviceHistory'

const car: Car = {
  id: 'c1',
  make: 'Hyundai',
  model: 'Genesis Coupe',
  year: 2011,
  engine: '3.8L V6',
  vin: 'KMHHU61HXBU100001',
  odometer: 150_000,
  createdAt: 'x',
  updatedAt: 'x',
}

let n = 0
function entry(over: Partial<LogEntry>): LogEntry {
  n += 1
  return {
    id: `e${n}`,
    carId: 'c1',
    date: '2026-01-01',
    odometer: 150_000,
    cost: 100,
    category: 'service',
    createdAt: 'x',
    updatedAt: 'x',
    ...over,
  }
}

const entries: LogEntry[] = [
  entry({ date: '2026-02-01', category: 'service', odometer: 151_000, cost: 180, notes: 'Oil + filter' }),
  entry({ date: '2026-06-01', category: 'repair', odometer: 154_000, cost: 420, notes: 'Front brakes' }),
  entry({ date: '2026-03-01', category: 'fuel', odometer: 152_000, cost: 65, litres: 40 }),
  entry({ date: '2026-04-01', category: 'tyres', odometer: 153_000, cost: 600 }),
  entry({ date: '2026-05-01', category: 'fuel', odometer: 153_500, cost: 70, litres: 42 }),
  entry({ carId: 'other', date: '2026-07-01', category: 'service', odometer: 9, cost: 999 }),
]

describe('buildServiceHistory', () => {
  const h = buildServiceHistory(car, entries, '2026-07-20')

  it('excludes fuel and other cars from the records', () => {
    expect(h.records.map((r) => r.category)).toEqual(['repair', 'tyres', 'service'])
    expect(h.records.some((r) => r.category === 'fuel')).toBe(false)
    expect(h.records.some((r) => r.odometer === 9)).toBe(false) // other car
  })

  it('orders records newest first', () => {
    expect(h.records.map((r) => r.date)).toEqual(['2026-06-01', '2026-04-01', '2026-02-01'])
  })

  it('sums service spend but keeps fuel spend separate', () => {
    expect(h.totalRecordedCost).toBe(180 + 420 + 600)
    expect(h.fuelSpend).toBe(135)
  })

  it('takes the odometer from the highest entry, not the car profile', () => {
    expect(h.odometer).toBe(154_000)
  })

  it('carries the identifying details', () => {
    expect(h.title).toBe('Hyundai Genesis Coupe')
    expect(h.subtitle).toBe('2011 · 3.8L V6')
    expect(h.vin).toBe('KMHHU61HXBU100001')
    expect(h.recordCount).toBe(3)
  })

  it('handles a car with no records', () => {
    const bare = buildServiceHistory(car, [], '2026-07-20')
    expect(bare.records).toEqual([])
    expect(bare.totalRecordedCost).toBe(0)
    expect(bare.odometer).toBe(150_000) // falls back to the car profile
  })
})

describe('historyToHtml', () => {
  const html = historyToHtml(buildServiceHistory(car, entries, '2026-07-20'))

  it('is a self-contained document with no external assets', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).not.toMatch(/https?:\/\//) // nothing to fetch → works offline
    expect(html).toContain('<style>')
  })

  it('includes the records and the VIN', () => {
    expect(html).toContain('Front brakes')
    expect(html).toContain('KMHHU61HXBU100001')
    expect(html).toContain('420.00 €')
  })

  it('escapes notes so a receipt string cannot inject markup', () => {
    const nasty = historyToHtml(
      buildServiceHistory(car, [entry({ category: 'repair', notes: '<script>x</script>' })], '2026-07-20'),
    )
    expect(nasty).not.toContain('<script>x')
    expect(nasty).toContain('&lt;script&gt;')
  })

  it('shows an empty-state line when there is nothing to record', () => {
    expect(historyToHtml(buildServiceHistory(car, [], '2026-07-20'))).toContain('No service')
  })
})

describe('historyToText', () => {
  it('is plain text with one line per record, newest first', () => {
    const text = historyToText(buildServiceHistory(car, entries, '2026-07-20'))
    const lines = text.split('\n')
    expect(lines[0]).toContain('Hyundai Genesis Coupe')
    expect(text).toContain('2026-06-01  Repair @ 154,000 km  420.00 € — Front brakes')
    expect(text).not.toContain('Fuel')
  })
})
