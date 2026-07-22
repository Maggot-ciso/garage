import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Car, LogEntry, Reminder, TyreSet } from '../db/db'
import { buildCarContext, agentSystemPrompt } from './context'

const car: Car = {
  id: 'car-1',
  make: 'Hyundai',
  model: 'Genesis Coupe',
  year: 2012,
  engine: '3.8 V6',
  odometer: 150000,
  createdAt: '',
  updatedAt: '',
}

function entry(overrides: Partial<LogEntry>): LogEntry {
  return {
    id: 'e',
    carId: 'car-1',
    date: '2026-07-01',
    odometer: 155000,
    cost: 68.5,
    category: 'fuel',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('buildCarContext', () => {
  it('includes profile, engine and the highest known odometer', () => {
    const ctx = buildCarContext({ car, entries: [entry({ odometer: 155650 })], reminders: [] })
    expect(ctx).toContain('2012 Hyundai Genesis Coupe')
    expect(ctx).toContain('3.8 V6')
    expect(ctx).toContain('155,650 km')
  })

  it('lists open reminders but not completed ones', () => {
    const reminders: Reminder[] = [
      { id: 'r1', carId: 'car-1', title: 'Oil change', dueOdometer: 160000, createdAt: '', updatedAt: '' },
      { id: 'r2', carId: 'car-1', title: 'Done thing', dueDate: '2026-01-01', completedAt: 'x', createdAt: '', updatedAt: '' },
      { id: 'r3', carId: 'other', title: 'Other car', dueDate: '2026-01-01', createdAt: '', updatedAt: '' },
    ]
    const ctx = buildCarContext({ car, entries: [], reminders })
    expect(ctx).toContain('Oil change (at 160,000 km)')
    expect(ctx).not.toContain('Done thing')
    expect(ctx).not.toContain('Other car')
  })

  it('summarizes recent entries and lifetime totals, ignoring other cars', () => {
    const entries = [
      entry({ id: 'a', litres: 45.3, fullTank: true }),
      entry({ id: 'b', category: 'service', cost: 200, notes: 'oil + filter', date: '2026-06-01' }),
      entry({ id: 'c', carId: 'other-car', cost: 9999 }),
    ]
    const ctx = buildCarContext({ car, entries, reminders: [] })
    expect(ctx).toContain('45.3 L full')
    expect(ctx).toContain('oil + filter')
    expect(ctx).toContain('fuel 68.50€')
    expect(ctx).toContain('service 200.00€')
    expect(ctx).not.toContain('9999')
  })

  it('says so when the logbook is empty', () => {
    expect(buildCarContext({ car, entries: [], reminders: [] })).toContain('no entries yet')
  })
})

// Everything below was missing from the context the model actually received:
// a tyre question was answered with no tyre data at all, and the logbook was
// truncated at 20 entries with no hint that more existed.
describe('buildCarContext — the rest of what is stored', () => {
  function tyreSet(overrides: Partial<TyreSet> = {}): TyreSet {
    return {
      id: 't1',
      carId: 'car-1',
      season: 'winter',
      brand: 'Nokian',
      size: '225/40 R19',
      status: 'stored',
      storageLocation: 'garage shelf',
      treadReadings: [{ date: '2026-03-01', mm: 6.5 }],
      fittedPeriods: [],
      createdAt: '',
      updatedAt: '',
      ...overrides,
    }
  }

  it('includes tyre sets with season, size, tread and where they are', () => {
    const ctx = buildCarContext({ car, entries: [], reminders: [], tyreSets: [tyreSet()] })
    expect(ctx).toContain('225/40 R19')
    expect(ctx).toContain('6.5 mm')
    expect(ctx).toContain('garage shelf')
  })

  it('does not attribute another vehicle\u2019s tyres to this one', () => {
    const ctx = buildCarContext({
      car,
      entries: [],
      reminders: [],
      tyreSets: [tyreSet({ id: 't2', carId: 'other-car', brand: 'Someone Else' })],
    })
    expect(ctx).not.toContain('Someone Else')
  })

  it('names the other vehicles in the garage but not this one twice', () => {
    const other: Car = { ...car, id: 'car-2', make: 'Yamaha', model: 'MT-07', year: 2021 }
    const ctx = buildCarContext({ car, entries: [], reminders: [], otherCars: [car, other] })
    expect(ctx).toContain('2021 Yamaha MT-07')
    expect(ctx.match(/Genesis Coupe/g)).toHaveLength(1)
  })

  it('mentions documents by name without carrying any bytes', () => {
    const ctx = buildCarContext({
      car,
      entries: [],
      reminders: [],
      documents: [{ name: 'pzp-2026.pdf', createdAt: '2026-07-22T10:00:00.000Z' }],
    })
    expect(ctx).toContain('pzp-2026.pdf')
    expect(ctx).toContain('2026-07-22')
  })

  it('carries company and line items so "who did the brakes" is answerable', () => {
    const ctx = buildCarContext({
      car,
      entries: [
        entry({
          category: 'repair',
          cost: 320,
          company: 'Autoservis Novak',
          items: [
            { name: 'Brake pads front', price: 120 },
            { name: 'Labour', price: 200 },
          ],
        }),
      ],
      reminders: [],
    })
    expect(ctx).toContain('Autoservis Novak')
    expect(ctx).toContain('Brake pads front 120.00')
  })

  it('rolls up entries beyond the recent window instead of dropping them', () => {
    // 25 entries: 20 verbatim, 5 older summarised rather than silently lost.
    const entries = [
      ...Array.from({ length: 20 }, (_, i) =>
        entry({ id: `new-${i}`, date: `2026-06-${String(i + 1).padStart(2, '0')}` }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        entry({
          id: `old-${i}`,
          date: `2019-03-0${i + 1}`,
          category: 'service',
          cost: 100,
          odometer: 90000 + i * 1000,
        }),
      ),
    ]
    const ctx = buildCarContext({ car, entries, reminders: [] })

    expect(ctx).toContain('Last 20 logbook entries')
    expect(ctx).toContain('5 older entries')
    expect(ctx).toMatch(/2019: service \u00d75 500\.00\u20ac/)
    // The rolled-up years are summarised, never listed line by line
    expect(ctx).not.toContain('2019-03-01 service')
  })

  it('does not claim an earlier history that does not exist', () => {
    const ctx = buildCarContext({ car, entries: [entry({})], reminders: [] })
    expect(ctx).not.toContain('Earlier history')
  })
})

describe('agentSystemPrompt', () => {
  // The sourcing rule follows the device's region, so a driver anywhere gets
  // advice they can actually buy from — not a hardcoded country.
  function stubLocale(tag: string) {
    vi.stubGlobal('navigator', { languages: [tag], language: tag })
  }
  afterEach(() => vi.unstubAllGlobals())

  it('includes the car context', () => {
    stubLocale('sk-SK')
    expect(agentSystemPrompt('CAR CONTEXT')).toContain('CAR CONTEXT')
  })

  it('targets the EU as a bloc for a driver in a member state', () => {
    stubLocale('sk-SK')
    const prompt = agentSystemPrompt('CAR CONTEXT')
    expect(prompt).toMatch(/Slovakia \(EU\)/)
    expect(prompt).toMatch(/ship to the EU/i)
  })

  it('targets the driver\'s own country outside the EU', () => {
    stubLocale('en-US')
    const prompt = agentSystemPrompt('CAR CONTEXT')
    expect(prompt).toMatch(/ship to United States/i)
    expect(prompt).not.toMatch(/ship to the EU/i)
  })

  it('keeps the honest sourcing caveats whatever the region', () => {
    for (const tag of ['sk-SK', 'en-US', 'xx']) {
      stubLocale(tag)
      const prompt = agentSystemPrompt('CAR CONTEXT')
      // never claims to verify shipping, and never leaks an undefined region
      expect(prompt).toMatch(/cannot verify live shipping/i)
      expect(prompt).not.toMatch(/undefined|null/)
    }
  })
})

// The two new search abilities. Both answers are live — which dealer is open,
// what a policy costs this month — so the rules must forbid answering from
// memory without forbidding the search itself.
describe('agentSystemPrompt — service centres and insurance', () => {
  function stubLocale(tag: string) {
    vi.stubGlobal('navigator', { languages: [tag], language: tag })
  }
  afterEach(() => vi.unstubAllGlobals())

  it('makes the assistant ask where the driver is before hunting a dealer', () => {
    stubLocale('sk-SK')
    const prompt = agentSystemPrompt('CTX')
    expect(prompt).toMatch(/ask for their town/i)
    expect(prompt).toMatch(/never invent a dealer name, address, phone number/i)
  })

  it('names the real Slovak PZP comparators for a Slovak driver', () => {
    stubLocale('sk-SK')
    const prompt = agentSystemPrompt('CTX')
    expect(prompt).toContain('Netfinancie.sk')
    expect(prompt).toContain('https://www.netfinancie.sk/pzp/')
  })

  it('falls back to searching rather than naming a comparator it has not checked', () => {
    stubLocale('de-DE')
    const prompt = agentSystemPrompt('CTX')
    expect(prompt).not.toContain('Netfinancie.sk')
    expect(prompt).toMatch(/use web_search to find one/i)
  })

  it('forbids quoting a premium as the driver\u2019s price, in every region', () => {
    for (const tag of ['sk-SK', 'de-DE', 'en-US', 'xx']) {
      stubLocale(tag)
      const prompt = agentSystemPrompt('CTX')
      expect(prompt).toMatch(/never quote a figure as their price/i)
      expect(prompt).toMatch(/cheapest PZP is not automatically the best/i)
      expect(prompt).not.toMatch(/undefined|null/)
    }
  })
})

describe('agentSystemPrompt — language', () => {
  function stubLocale(tag: string) {
    vi.stubGlobal('navigator', { languages: [tag], language: tag })
  }
  afterEach(() => vi.unstubAllGlobals())

  it('asks for Slovak answers when the app is Slovak', () => {
    stubLocale('sk-SK')
    const prompt = agentSystemPrompt('CAR CONTEXT', 'sk')
    expect(prompt).toMatch(/po slovensky/i)
    // Part names and OBD codes must stay verbatim — that is how catalogues list them
    expect(prompt).toMatch(/neprekladaj/i)
  })

  it('asks for English by default', () => {
    stubLocale('en-GB')
    expect(agentSystemPrompt('CAR CONTEXT')).toMatch(/Answer in English/i)
  })
})
