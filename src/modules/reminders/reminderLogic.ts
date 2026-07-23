import type { Car, LogEntry, Reminder } from '../../db/db'
import type { FieldError } from '../../i18n/fieldError'
import type { TranslationKey } from '../../i18n/en'
import type { PluralForms } from '../../i18n/plural'

// describeDue/describeRepeat produce text a person reads, so they take the
// translator rather than building English. Slovak needs three plural forms for
// days and months, which is what `plural` is for.
export interface Translate {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  plural: (count: number, forms: PluralForms) => string
  /** BCP-47 tag, so numbers group the way the chosen language groups them. */
  locale: string
}

function dayForms(tr: Translate): PluralForms {
  return {
    one: tr.t('due.days.one'),
    few: tr.t('due.days.few'),
    many: tr.t('due.days.many'),
    other: tr.t('due.days.other'),
  }
}

function monthForms(tr: Translate): PluralForms {
  return {
    one: tr.t('repeat.months.one'),
    few: tr.t('repeat.months.few'),
    many: tr.t('repeat.months.many'),
    other: tr.t('repeat.months.other'),
  }
}
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

export function describeDue(
  reminder: Reminder,
  odometer: number,
  todayISO: string,
  tr: Translate,
): string {
  const parts: string[] = []
  if (reminder.dueOdometer !== undefined) {
    const kmLeft = reminder.dueOdometer - odometer
    parts.push(
      kmLeft <= 0
        ? tr.t('due.atKm', {
            km: reminder.dueOdometer.toLocaleString(tr.locale),
            now: odometer.toLocaleString(tr.locale),
          })
        : tr.t('due.inKm', { km: kmLeft.toLocaleString(tr.locale) }),
    )
  }
  if (reminder.dueDate !== undefined) {
    const days = daysUntil(reminder.dueDate, todayISO)
    parts.push(
      days < 0
        ? tr.t('due.sinceDate', { date: reminder.dueDate })
        : days === 0
          ? tr.t('due.today')
          : tr.plural(days, dayForms(tr)),
    )
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
  tr: Translate,
): string | null {
  const parts: string[] = []
  if (reminder.repeatKm !== undefined) {
    parts.push(tr.t('repeat.km', { km: reminder.repeatKm.toLocaleString(tr.locale) }))
  }
  if (reminder.repeatMonths !== undefined) {
    parts.push(tr.plural(reminder.repeatMonths, monthForms(tr)))
  }
  return parts.length ? tr.t('repeat.every', { what: parts.join(' · ') }) : null
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
  // Both are translation keys. `title` matters as much as `label`: picking a
  // preset writes that title into the reminder, so a Slovak user must get a
  // Slovak reminder, not an English one they then have to retype.
  label: TranslationKey
  title: TranslationKey
  repeatKm?: number
  repeatMonths?: number
}

export const REMINDER_PRESETS: ReminderPreset[] = [
  { label: 'preset.oil.label', title: 'preset.oil.title', repeatKm: 10000, repeatMonths: 12 },
  { label: 'preset.inspection.label', title: 'preset.inspection.title', repeatMonths: 24 },
  { label: 'preset.insurance.label', title: 'preset.insurance.title', repeatMonths: 12 },
  { label: 'preset.vignette.label', title: 'preset.vignette.title', repeatMonths: 12 },
  { label: 'preset.tyreSwap.label', title: 'preset.tyreSwap.title', repeatMonths: 6 },
]

export function presetFormValues(
  preset: ReminderPreset,
  currentOdo: number,
  todayISO: string,
  t: (key: TranslationKey) => string,
): ReminderFormValues {
  return {
    title: t(preset.title),
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
  Record<'title' | 'dueDate' | 'dueOdometer' | 'repeatKm' | 'repeatMonths', FieldError>
>

export function validateReminder(
  values: ReminderFormValues,
  carId: string,
): { fields?: ReminderFields; errors: ReminderFormErrors } {
  const errors: ReminderFormErrors = {}
  const title = values.title.trim()
  const dateStr = values.dueDate.trim()
  const odoStr = values.dueOdometer.trim()

  if (!title) errors.title = 'validate.reminderTitle'

  if (dateStr && (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || Number.isNaN(Date.parse(dateStr)))) {
    errors.dueDate = 'validate.notValidDate'
  }

  const dueOdometer = Number(odoStr)
  if (odoStr && (!Number.isFinite(dueOdometer) || dueOdometer < 0)) {
    errors.dueOdometer = 'validate.mileageMin'
  }

  if (!dateStr && !odoStr) {
    errors.dueDate = 'validate.dateOrMileage'
    errors.dueOdometer = 'validate.dateOrMileage'
  }

  const repeatKmStr = values.repeatKm.trim()
  const repeatKm = Number(repeatKmStr)
  if (repeatKmStr && (!Number.isInteger(repeatKm) || repeatKm <= 0)) {
    errors.repeatKm = 'validate.wholeKm'
  }
  const repeatMonthsStr = values.repeatMonths.trim()
  const repeatMonths = Number(repeatMonthsStr)
  if (repeatMonthsStr && (!Number.isInteger(repeatMonths) || repeatMonths <= 0)) {
    errors.repeatMonths = 'validate.wholeMonths'
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
