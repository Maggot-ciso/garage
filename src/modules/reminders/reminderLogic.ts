import type { Car, LogEntry, Reminder } from '../../db/db'
import type { ReminderFields } from '../../db/reminders'

export const SOON_DAYS = 14
export const SOON_KM = 500

export type ReminderStatus = 'due' | 'soon' | 'upcoming'

// The car profile's odometer can lag behind the logbook — trust the highest.
export function currentOdometer(car: Car, entries: LogEntry[]): number {
  return entries
    .filter((e) => e.carId === car.id)
    .reduce((max, e) => Math.max(max, e.odometer), car.odometer)
}

function daysUntil(dateISO: string, todayISO: string): number {
  return Math.ceil((Date.parse(dateISO) - Date.parse(todayISO)) / 86_400_000)
}

export function reminderStatus(
  reminder: Reminder,
  odometer: number,
  todayISO: string,
): ReminderStatus {
  const byDate = reminder.dueDate !== undefined && reminder.dueDate <= todayISO
  const byKm = reminder.dueOdometer !== undefined && odometer >= reminder.dueOdometer
  if (byDate || byKm) return 'due'

  const soonByDate =
    reminder.dueDate !== undefined && daysUntil(reminder.dueDate, todayISO) <= SOON_DAYS
  const soonByKm =
    reminder.dueOdometer !== undefined && reminder.dueOdometer - odometer <= SOON_KM
  if (soonByDate || soonByKm) return 'soon'

  return 'upcoming'
}

export function describeDue(reminder: Reminder, odometer: number, todayISO: string): string {
  const parts: string[] = []
  if (reminder.dueOdometer !== undefined) {
    const kmLeft = reminder.dueOdometer - odometer
    parts.push(
      kmLeft <= 0
        ? `at ${reminder.dueOdometer.toLocaleString()} km (now ${odometer.toLocaleString()})`
        : `in ${kmLeft.toLocaleString()} km`,
    )
  }
  if (reminder.dueDate !== undefined) {
    const days = daysUntil(reminder.dueDate, todayISO)
    parts.push(days <= 0 ? `since ${reminder.dueDate}` : `in ${days} day${days === 1 ? '' : 's'}`)
  }
  return parts.join(' · ')
}

const STATUS_RANK: Record<ReminderStatus, number> = { due: 0, soon: 1, upcoming: 2 }

export function sortReminders(
  reminders: Reminder[],
  odometerByCar: Map<string, number>,
  todayISO: string,
): { reminder: Reminder; status: ReminderStatus }[] {
  return reminders
    .map((reminder) => ({
      reminder,
      status: reminderStatus(reminder, odometerByCar.get(reminder.carId) ?? 0, todayISO),
    }))
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        (a.reminder.dueDate ?? '9999').localeCompare(b.reminder.dueDate ?? '9999') ||
        (a.reminder.dueOdometer ?? Infinity) - (b.reminder.dueOdometer ?? Infinity),
    )
}

// Calendar-safe month addition: Jan 31 + 1mo = Feb 28 (day clamps).
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const total = m - 1 + months
  const year = y + Math.floor(total / 12)
  const monthIndex = ((total % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const day = Math.min(d, lastDay)
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Human-readable recurrence for the list, e.g. "every 10,000 km · 12 months".
export function describeRepeat(
  reminder: Pick<Reminder, 'repeatKm' | 'repeatMonths'>,
): string | null {
  const parts: string[] = []
  if (reminder.repeatKm !== undefined) parts.push(`${reminder.repeatKm.toLocaleString()} km`)
  if (reminder.repeatMonths !== undefined) {
    parts.push(`${reminder.repeatMonths} month${reminder.repeatMonths === 1 ? '' : 's'}`)
  }
  return parts.length ? `every ${parts.join(' · ')}` : null
}

export function isRecurring(reminder: Pick<Reminder, 'repeatKm' | 'repeatMonths'>): boolean {
  return reminder.repeatKm !== undefined || reminder.repeatMonths !== undefined
}

// Approach A: the next occurrence rolls forward from the moment of
// completion — current odometer + repeatKm, today + repeatMonths.
export function nextReminderFields(
  reminder: Reminder,
  currentOdo: number,
  todayISO: string,
): ReminderFields | null {
  if (!isRecurring(reminder)) return null
  return {
    carId: reminder.carId,
    title: reminder.title,
    ...(reminder.notes ? { notes: reminder.notes } : {}),
    ...(reminder.repeatKm !== undefined
      ? { repeatKm: reminder.repeatKm, dueOdometer: currentOdo + reminder.repeatKm }
      : {}),
    ...(reminder.repeatMonths !== undefined
      ? { repeatMonths: reminder.repeatMonths, dueDate: addMonths(todayISO, reminder.repeatMonths) }
      : {}),
  }
}

export interface ReminderPreset {
  label: string
  title: string
  repeatKm?: number
  repeatMonths?: number
}

export const REMINDER_PRESETS: ReminderPreset[] = [
  { label: 'Oil change', title: 'Oil change', repeatKm: 10000, repeatMonths: 12 },
  { label: 'STK/EK', title: 'STK/EK inspection', repeatMonths: 24 },
  { label: 'Insurance', title: 'Insurance renewal', repeatMonths: 12 },
  { label: 'Vignette', title: 'Highway vignette', repeatMonths: 12 },
  { label: 'Tyre swap', title: 'Tyre swap', repeatMonths: 6 },
]

export function presetFormValues(
  preset: ReminderPreset,
  currentOdo: number,
  todayISO: string,
): ReminderFormValues {
  return {
    title: preset.title,
    dueOdometer: preset.repeatKm !== undefined ? String(currentOdo + preset.repeatKm) : '',
    dueDate: preset.repeatMonths !== undefined ? addMonths(todayISO, preset.repeatMonths) : '',
    repeatKm: preset.repeatKm !== undefined ? String(preset.repeatKm) : '',
    repeatMonths: preset.repeatMonths !== undefined ? String(preset.repeatMonths) : '',
    notes: '',
  }
}

export interface ReminderFormValues {
  title: string
  dueDate: string
  dueOdometer: string
  repeatKm: string
  repeatMonths: string
  notes: string
}

export type ReminderFormErrors = Partial<
  Record<'title' | 'dueDate' | 'dueOdometer' | 'repeatKm' | 'repeatMonths', string>
>

export function validateReminder(
  values: ReminderFormValues,
  carId: string,
): { fields?: ReminderFields; errors: ReminderFormErrors } {
  const errors: ReminderFormErrors = {}
  const title = values.title.trim()
  const dateStr = values.dueDate.trim()
  const odoStr = values.dueOdometer.trim()

  if (!title) errors.title = 'Give the reminder a name'

  if (dateStr && (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || Number.isNaN(Date.parse(dateStr)))) {
    errors.dueDate = 'Not a valid date'
  }

  const dueOdometer = Number(odoStr)
  if (odoStr && (!Number.isFinite(dueOdometer) || dueOdometer < 0)) {
    errors.dueOdometer = 'Mileage must be 0 or more'
  }

  if (!dateStr && !odoStr) {
    errors.dueDate = 'Set a date, a mileage, or both'
    errors.dueOdometer = 'Set a date, a mileage, or both'
  }

  const repeatKmStr = values.repeatKm.trim()
  const repeatKm = Number(repeatKmStr)
  if (repeatKmStr && (!Number.isInteger(repeatKm) || repeatKm <= 0)) {
    errors.repeatKm = 'Must be a whole number of km'
  }
  const repeatMonthsStr = values.repeatMonths.trim()
  const repeatMonths = Number(repeatMonthsStr)
  if (repeatMonthsStr && (!Number.isInteger(repeatMonths) || repeatMonths <= 0)) {
    errors.repeatMonths = 'Must be a whole number of months'
  }

  if (Object.keys(errors).length > 0) return { errors }

  const notes = values.notes.trim()
  return {
    errors,
    fields: {
      carId,
      title,
      ...(dateStr ? { dueDate: dateStr } : {}),
      ...(odoStr ? { dueOdometer } : {}),
      ...(repeatKmStr ? { repeatKm } : {}),
      ...(repeatMonthsStr ? { repeatMonths } : {}),
      ...(notes ? { notes } : {}),
    },
  }
}
