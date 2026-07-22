import { describe, expect, it } from 'vitest'
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
  it('carries the EU-shipping sourcing rule so parts are actually buyable here', () => {
    const prompt = agentSystemPrompt('CAR CONTEXT')
    expect(prompt).toContain('CAR CONTEXT')
    expect(prompt).toMatch(/ship to the EU/i)
    expect(prompt).toMatch(/RockAuto/)
    expect(prompt).toMatch(/customs or VAT/i)
    // honest: never claims to verify shipping
    expect(prompt).toMatch(/cannot verify live shipping/i)
  })
})
