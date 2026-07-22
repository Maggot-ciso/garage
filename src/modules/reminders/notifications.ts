import type { Car, Reminder } from '../../db/db'

// iOS local notifications only fire on a schedule the phone can evaluate, so
// only date-based reminders plan one. Odometer-based reminders stay in-app
// (the due banner) — the phone has no idea how far the car has driven.

// Notification ids must be int32 on iOS; derive a stable one from the string
// id (FNV-1a) so re-planning the same reminder replaces its notification.
export function notificationId(reminderId: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < reminderId.length; i++) {
    hash ^= reminderId.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash & 0x7fffffff
}

// Morning, not midnight: a "tyre swap due" buzz at 00:00 helps nobody.
export const FIRE_HOUR = 9

// iOS silently drops everything past 64 pending local notifications.
export const MAX_PENDING = 64

export interface PlannedNotification {
  id: number
  title: string
  body: string
  at: Date
}

export function fireTime(dueDate: string): Date {
  const [y, m, d] = dueDate.split('-').map(Number)
  return new Date(y, m - 1, d, FIRE_HOUR, 0, 0, 0)
}

export function planNotifications(
  reminders: Reminder[],
  cars: Car[],
  now: Date,
): PlannedNotification[] {
  const carName = new Map(cars.map((c) => [c.id, [c.make, c.model].filter(Boolean).join(' ')]))
  return reminders
    .filter((r) => !r.completedAt && r.dueDate !== undefined)
    .map((r) => ({ reminder: r, at: fireTime(r.dueDate!) }))
    // A fire time in the past would either fire instantly or be dropped —
    // overdue reminders are the due banner's job, not a notification's.
    .filter(({ at }) => at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_PENDING)
    .map(({ reminder, at }) => ({
      id: notificationId(reminder.id),
      title: reminder.title,
      body: [carName.get(reminder.carId), `due ${reminder.dueDate}`]
        .filter(Boolean)
        .join(' · '),
      at,
    }))
}
