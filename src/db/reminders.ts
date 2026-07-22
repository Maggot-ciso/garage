import { db, type Reminder } from './db'
import { newId } from './id'

export type ReminderFields = Omit<Reminder, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>

export async function addReminder(fields: ReminderFields): Promise<Reminder> {
  const now = new Date().toISOString()
  const reminder: Reminder = { ...fields, id: newId(), createdAt: now, updatedAt: now }
  await db.reminders.add(reminder)
  return reminder
}

export async function updateReminder(id: string, fields: ReminderFields): Promise<void> {
  const existing = await db.reminders.get(id)
  if (!existing) throw new Error(`Reminder ${id} not found`)
  // put (not update) so a cleared dueDate/dueOdometer doesn't linger
  await db.reminders.put({
    ...fields,
    id,
    createdAt: existing.createdAt,
    ...(existing.completedAt ? { completedAt: existing.completedAt } : {}),
    updatedAt: new Date().toISOString(),
  })
}

export async function completeReminder(id: string): Promise<void> {
  const updated = await db.reminders.update(id, {
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  if (updated === 0) throw new Error(`Reminder ${id} not found`)
}

export async function deleteReminder(id: string): Promise<void> {
  await db.reminders.delete(id)
}

export async function openReminders(): Promise<Reminder[]> {
  return (await db.reminders.toArray()).filter((r) => !r.completedAt)
}
