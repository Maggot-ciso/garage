import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Car, LogEntry, Reminder } from '../db/db'
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
    const ctx = buildCarContext(car, [entry({ odometer: 155650 })], [])
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
    const ctx = buildCarContext(car, [], reminders)
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
    const ctx = buildCarContext(car, entries, [])
    expect(ctx).toContain('45.3 L full')
    expect(ctx).toContain('oil + filter')
    expect(ctx).toContain('fuel 68.50€')
    expect(ctx).toContain('service 200.00€')
    expect(ctx).not.toContain('9999')
  })

  it('says so when the logbook is empty', () => {
    expect(buildCarContext(car, [], [])).toContain('no entries yet')
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
