import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  addReminder,
  completeReminder,
  deleteReminder,
  openReminders,
  updateReminder,
  type ReminderFields,
} from './reminders'

const fields: ReminderFields = {
  carId: 'car-1',
  title: 'Oil change',
  dueOdometer: 165000,
  dueDate: '2026-10-01',
}

beforeEach(async () => {
  await db.reminders.clear()
})

describe('reminders repository', () => {
  it('adds and lists open reminders', async () => {
    await addReminder(fields)
    expect(await openReminders()).toHaveLength(1)
  })

  it('completing hides from open list but keeps the record', async () => {
    const r = await addReminder(fields)
    await completeReminder(r.id)
    expect(await openReminders()).toHaveLength(0)
    expect((await db.reminders.get(r.id))?.completedAt).toBeDefined()
  })

  it('update replaces so a cleared due condition does not linger', async () => {
    const r = await addReminder(fields)
    await updateReminder(r.id, { carId: 'car-1', title: 'Oil + filter', dueDate: '2026-11-01' })
    const stored = await db.reminders.get(r.id)
    expect(stored?.title).toBe('Oil + filter')
    expect(stored?.dueOdometer).toBeUndefined()
    expect(stored?.createdAt).toBe(r.createdAt)
  })

  it('deletes a reminder', async () => {
    const r = await addReminder(fields)
    await deleteReminder(r.id)
    expect(await db.reminders.get(r.id)).toBeUndefined()
  })
})
