import { describe, expect, it } from 'vitest'
import type { Car, Reminder } from '../../db/db'
import {
  FIRE_HOUR,
  MAX_PENDING,
  fireTime,
  notificationId,
  planNotifications,
} from './notifications'

const car: Car = {
  id: 'car1',
  make: 'Hyundai',
  model: 'Genesis Coupe',
  odometer: 100_000,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as Car

function reminder(overrides: Partial<Reminder>): Reminder {
  return {
    id: 'r1',
    carId: 'car1',
    title: 'Oil change',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Reminder
}

const now = new Date(2026, 6, 20, 12, 0) // 2026-07-20 noon

describe('notificationId', () => {
  it('is stable for the same id', () => {
    expect(notificationId('abc')).toBe(notificationId('abc'))
  })
  it('differs across ids and fits int32', () => {
    const a = notificationId('reminder-a')
    const b = notificationId('reminder-b')
    expect(a).not.toBe(b)
    for (const n of [a, b]) {
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(0x7fffffff)
      expect(Number.isInteger(n)).toBe(true)
    }
  })
})

describe('fireTime', () => {
  it('fires the morning of the due date, local time', () => {
    const at = fireTime('2026-08-01')
    expect(at.getFullYear()).toBe(2026)
    expect(at.getMonth()).toBe(7)
    expect(at.getDate()).toBe(1)
    expect(at.getHours()).toBe(FIRE_HOUR)
  })
})

describe('planNotifications', () => {
  it('plans a future date-based reminder with car context', () => {
    const plans = planNotifications([reminder({ dueDate: '2026-08-01' })], [car], now)
    expect(plans).toHaveLength(1)
    expect(plans[0].title).toBe('Oil change')
    expect(plans[0].body).toBe('Hyundai Genesis Coupe · due 2026-08-01')
    expect(plans[0].id).toBe(notificationId('r1'))
  })

  it('skips completed, overdue, and km-only reminders', () => {
    const plans = planNotifications(
      [
        reminder({ id: 'done', dueDate: '2026-08-01', completedAt: '2026-07-01T00:00:00Z' }),
        reminder({ id: 'overdue', dueDate: '2026-07-19' }),
        reminder({ id: 'km-only', dueOdometer: 110_000 }),
        reminder({ id: 'ok', dueDate: '2026-09-01' }),
      ],
      [car],
      now,
    )
    expect(plans.map((p) => p.id)).toEqual([notificationId('ok')])
  })

  it('skips a due date today when the morning fire time already passed', () => {
    // now is noon; 09:00 today is gone — the due banner owns it from here
    expect(planNotifications([reminder({ dueDate: '2026-07-20' })], [car], now)).toHaveLength(0)
  })

  it('keeps the soonest 64 when over the iOS pending limit', () => {
    const many = Array.from({ length: 70 }, (_, i) =>
      reminder({ id: `r${i}`, dueDate: `2026-09-${String((i % 28) + 1).padStart(2, '0')}` }),
    )
    const plans = planNotifications(many, [car], now)
    expect(plans).toHaveLength(MAX_PENDING)
    const times = plans.map((p) => p.at.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('omits the car name when the car is unknown', () => {
    const plans = planNotifications([reminder({ dueDate: '2026-08-01', carId: 'gone' })], [], now)
    expect(plans[0].body).toBe('due 2026-08-01')
  })
})
