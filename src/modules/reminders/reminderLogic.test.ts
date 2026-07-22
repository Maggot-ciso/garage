import { describe, expect, it } from 'vitest'
import type { Car, LogEntry, Reminder } from '../../db/db'
import {
  REMINDER_PRESETS,
  addMonths,
  currentOdometer,
  describeDue,
  describeRepeat,
  nextReminderFields,
  presetFormValues,
  reminderStatus,
  sortReminders,
  type ReminderFormValues,
  validateReminder,
} from './reminderLogic'

const TODAY = '2026-07-16'

function reminder(overrides: Partial<Reminder>): Reminder {
  return {
    id: 'r1',
    carId: 'car-1',
    title: 'Oil change',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('reminderStatus', () => {
  it('is due when the date has passed or arrived', () => {
    expect(reminderStatus(reminder({ dueDate: '2026-07-16' }), 0, TODAY)).toBe('due')
    expect(reminderStatus(reminder({ dueDate: '2026-01-01' }), 0, TODAY)).toBe('due')
  })

  it('is due when the odometer has been reached', () => {
    expect(reminderStatus(reminder({ dueOdometer: 160000 }), 160000, TODAY)).toBe('due')
    expect(reminderStatus(reminder({ dueOdometer: 160000 }), 165000, TODAY)).toBe('due')
  })

  it('is soon within 14 days or 500 km', () => {
    expect(reminderStatus(reminder({ dueDate: '2026-07-30' }), 0, TODAY)).toBe('soon')
    expect(reminderStatus(reminder({ dueOdometer: 160000 }), 159600, TODAY)).toBe('soon')
  })

  it('is upcoming otherwise', () => {
    expect(reminderStatus(reminder({ dueDate: '2026-09-01' }), 0, TODAY)).toBe('upcoming')
    expect(reminderStatus(reminder({ dueOdometer: 160000 }), 150000, TODAY)).toBe('upcoming')
  })

  it('either condition can trigger due when both are set', () => {
    expect(
      reminderStatus(reminder({ dueDate: '2026-12-01', dueOdometer: 160000 }), 161000, TODAY),
    ).toBe('due')
  })
})

describe('currentOdometer', () => {
  const car = { id: 'car-1', odometer: 150000 } as Car
  it('takes the max of profile and logbook, ignoring other cars', () => {
    const entries = [
      { carId: 'car-1', odometer: 155000 },
      { carId: 'car-2', odometer: 999999 },
    ] as LogEntry[]
    expect(currentOdometer(car, entries)).toBe(155000)
    expect(currentOdometer(car, [])).toBe(150000)
  })
})

describe('describeDue', () => {
  it('describes remaining km and days', () => {
    expect(describeDue(reminder({ dueOdometer: 160000 }), 159000, TODAY)).toBe('in 1,000 km')
    expect(describeDue(reminder({ dueDate: '2026-07-17' }), 0, TODAY)).toBe('in 1 day')
  })

  it('describes overdue state', () => {
    expect(describeDue(reminder({ dueDate: '2026-07-01' }), 0, TODAY)).toBe('since 2026-07-01')
    expect(describeDue(reminder({ dueOdometer: 150000 }), 151000, TODAY)).toContain(
      'at 150,000 km',
    )
  })
})

describe('sortReminders', () => {
  it('orders due before soon before upcoming', () => {
    const odo = new Map([['car-1', 159600]])
    const list = [
      reminder({ id: 'up', dueOdometer: 170000 }),
      reminder({ id: 'due', dueDate: '2026-07-01' }),
      reminder({ id: 'soon', dueOdometer: 160000 }),
    ]
    expect(sortReminders(list, odo, TODAY).map((r) => r.reminder.id)).toEqual([
      'due',
      'soon',
      'up',
    ])
  })
})

describe('validateReminder', () => {
  const valid: ReminderFormValues = {
    title: 'Oil change',
    dueDate: '2026-10-01',
    dueOdometer: '165000',
    repeatKm: '',
    repeatMonths: '',
    notes: '',
  }

  it('accepts date+odometer and omits empty optionals', () => {
    const result = validateReminder(valid, 'car-1')
    expect(result.errors).toEqual({})
    expect(result.fields).toEqual({
      carId: 'car-1',
      title: 'Oil change',
      dueDate: '2026-10-01',
      dueOdometer: 165000,
    })
  })

  it('accepts date-only and mileage-only', () => {
    expect(validateReminder({ ...valid, dueOdometer: '' }, 'c').fields?.dueOdometer).toBeUndefined()
    expect(validateReminder({ ...valid, dueDate: '' }, 'c').fields?.dueDate).toBeUndefined()
  })

  it('requires a title and at least one due condition', () => {
    expect(validateReminder({ ...valid, title: ' ' }, 'c').errors.title).toBeDefined()
    const neither = validateReminder({ ...valid, dueDate: '', dueOdometer: '' }, 'c')
    expect(neither.fields).toBeUndefined()
    expect(neither.errors.dueDate).toBeDefined()
  })

  it('rejects malformed date and negative mileage', () => {
    expect(validateReminder({ ...valid, dueDate: '1.1.2027' }, 'c').errors.dueDate).toBeDefined()
    expect(
      validateReminder({ ...valid, dueOdometer: '-5' }, 'c').errors.dueOdometer,
    ).toBeDefined()
  })
})

describe('addMonths', () => {
  it('adds months and rolls the year', () => {
    expect(addMonths('2026-07-17', 6)).toBe('2027-01-17')
    expect(addMonths('2026-07-17', 24)).toBe('2028-07-17')
  })

  it('clamps the day when the target month is shorter', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29') // leap year
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30')
  })
})

describe('nextReminderFields', () => {
  it('rolls km and date forward from completion', () => {
    const r = reminder({ repeatKm: 10000, repeatMonths: 12, dueOdometer: 160000, dueDate: '2026-06-01', notes: 'full synth' })
    expect(nextReminderFields(r, 161500, TODAY)).toEqual({
      carId: 'car-1',
      title: 'Oil change',
      notes: 'full synth',
      repeatKm: 10000,
      dueOdometer: 171500,
      repeatMonths: 12,
      dueDate: '2027-07-16',
    })
  })

  it('handles km-only and months-only recurrence', () => {
    expect(nextReminderFields(reminder({ repeatKm: 5000 }), 150000, TODAY)).toMatchObject({
      dueOdometer: 155000,
    })
    expect(nextReminderFields(reminder({ repeatKm: 5000 }), 150000, TODAY)?.dueDate).toBeUndefined()
    expect(nextReminderFields(reminder({ repeatMonths: 24 }), 0, TODAY)).toMatchObject({
      dueDate: '2028-07-16',
    })
  })

  it('returns null for non-recurring reminders', () => {
    expect(nextReminderFields(reminder({ dueDate: '2026-08-01' }), 0, TODAY)).toBeNull()
  })
})

describe('presets', () => {
  it('every preset has a title and at least one interval', () => {
    for (const preset of REMINDER_PRESETS) {
      expect(preset.title.trim()).not.toBe('')
      expect(preset.repeatKm !== undefined || preset.repeatMonths !== undefined).toBe(true)
    }
  })

  it('prefills due values from current odometer and today', () => {
    const oil = REMINDER_PRESETS.find((p) => p.label === 'Oil change')!
    const values = presetFormValues(oil, 155650, TODAY)
    expect(values.dueOdometer).toBe('165650')
    expect(values.dueDate).toBe('2027-07-16')
    expect(values.repeatKm).toBe('10000')
    const filled = validateReminder(values, 'car-1')
    expect(filled.errors).toEqual({})
    expect(filled.fields).toMatchObject({ repeatKm: 10000, repeatMonths: 12 })
  })
})

describe('repeat validation', () => {
  const base: ReminderFormValues = {
    title: 'x', dueDate: '2026-10-01', dueOdometer: '', repeatKm: '', repeatMonths: '', notes: '',
  }

  it('accepts empty repeat fields (non-recurring)', () => {
    const r = validateReminder(base, 'c')
    expect(r.fields).not.toHaveProperty('repeatKm')
    expect(r.fields).not.toHaveProperty('repeatMonths')
  })

  it('rejects zero, negative and fractional intervals', () => {
    expect(validateReminder({ ...base, repeatKm: '0' }, 'c').errors.repeatKm).toBeDefined()
    expect(validateReminder({ ...base, repeatMonths: '-3' }, 'c').errors.repeatMonths).toBeDefined()
    expect(validateReminder({ ...base, repeatKm: '1.5' }, 'c').errors.repeatKm).toBeDefined()
  })
})

describe('describeRepeat', () => {
  it('describes a km + months interval', () => {
    expect(describeRepeat({ repeatKm: 10000, repeatMonths: 12 })).toBe('every 10,000 km · 12 months')
  })
  it('describes a single dimension', () => {
    expect(describeRepeat({ repeatKm: 15000 })).toBe('every 15,000 km')
    expect(describeRepeat({ repeatMonths: 1 })).toBe('every 1 month')
  })
  it('is null for a one-off reminder', () => {
    expect(describeRepeat({})).toBeNull()
  })
})
