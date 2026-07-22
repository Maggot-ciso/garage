import { useState } from 'react'
import { useT } from '../../i18n/I18nProvider'
import { Check, Repeat } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Reminder } from '../../db/db'
import {
  addReminder,
  completeReminder,
  deleteReminder,
  openReminders,
  updateReminder,
} from '../../db/reminders'
import {
  currentOdometer,
  describeDue,
  describeRepeat,
  isRecurring,
  nextReminderFields,
  sortReminders,
  type ReminderStatus,
} from './reminderLogic'
import { ReminderForm } from './ReminderForm'

type View = { mode: 'list' } | { mode: 'add' } | { mode: 'edit'; reminder: Reminder }

const STATUS_STYLE: Record<ReminderStatus, { dot: string; text: string }> = {
  due: { dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  soon: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  upcoming: { dot: 'bg-slate-300 dark:bg-slate-600', text: 'muted' },
}

// With carId set, the panel scopes to that one car (used on the car
// detail screen); without it, it shows every car's reminders (Garage).
export function RemindersPanel({ carId }: { carId?: string } = {}) {
  const [view, setView] = useState<View>({ mode: 'list' })
  const t = useT()
  const allCars = useLiveQuery(() => db.cars.orderBy('createdAt').toArray(), [])
  const allReminders = useLiveQuery(openReminders, [])
  const entries = useLiveQuery(() => db.entries.toArray(), [])

  if (allCars === undefined || allReminders === undefined || entries === undefined) return null
  const cars = carId ? allCars.filter((c) => c.id === carId) : allCars
  const reminders = carId ? allReminders.filter((r) => r.carId === carId) : allReminders
  if (cars.length === 0) return null

  const today = new Date().toISOString().slice(0, 10)
  const odometerByCar = new Map(cars.map((car) => [car.id, currentOdometer(car, entries)]))
  const sorted = sortReminders(reminders, odometerByCar, today)
  const carName = (carId: string) => {
    const car = cars.find((c) => c.id === carId)
    return car ? `${car.make} ${car.model}` : '?'
  }

  if (view.mode === 'add' || view.mode === 'edit') {
    const editing = view.mode === 'edit' ? view.reminder : undefined
    return (
      <section className="flex flex-col gap-3">
        <h2 className="section-title">{editing ? 'Edit reminder' : 'New reminder'}</h2>
        <ReminderForm
          cars={cars}
          odometerFor={(id) => odometerByCar.get(id) ?? 0}
          reminder={editing}
          onSave={async (fields) => {
            try {
              if (editing) await updateReminder(editing.id, fields)
              else await addReminder(fields)
              setView({ mode: 'list' })
            } catch (err) {
              window.alert(`Saving failed: ${err instanceof Error ? err.message : String(err)}`)
            }
          }}
          onCancel={() => setView({ mode: 'list' })}
          onDelete={
            editing
              ? async () => {
                  if (window.confirm(t('reminders.confirmDelete'))) {
                    await deleteReminder(editing.id)
                    setView({ mode: 'list' })
                  }
                }
              : undefined
          }
        />
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="section-title">{t('reminders.title')}</h2>
        <button
          type="button"
          onClick={() => setView({ mode: 'add' })}
          className="link-accent"
        >
          + Add
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="faint text-sm">{t('reminders.none')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map(({ reminder, status }) => (
            <li key={reminder.id} className="card flex items-center gap-3 p-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_STYLE[status].dot}`} />
              <button
                type="button"
                onClick={() => setView({ mode: 'edit', reminder })}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center gap-1.5 truncate font-medium">
                  {reminder.title}
                  {isRecurring(reminder) && (
                    <Repeat className="muted h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-label={t('reminders.a11yRepeats')} />
                  )}
                  {cars.length > 1 && (
                    <span className="faint font-normal"> · {carName(reminder.carId)}</span>
                  )}
                </div>
                <div className={`text-sm ${STATUS_STYLE[status].text}`}>
                  {status === 'due' ? 'Due ' : ''}
                  {describeDue(reminder, odometerByCar.get(reminder.carId) ?? 0, today)}
                </div>
                {describeRepeat(reminder) && (
                  <div className="faint text-xs">Repeats {describeRepeat(reminder)}</div>
                )}
              </button>
              <button
                type="button"
                aria-label={`Mark ${reminder.title} done`}
                onClick={async () => {
                  await completeReminder(reminder.id)
                  // Recurring reminders roll forward from completion. Tyre swap
                  // reminders are NOT rescheduled here — a swap reminder is a
                  // one-off "fit this set"; the seasonal next one is created by
                  // the swap flow when tyres are actually changed. Re-anchoring
                  // on every Done drifts the date a year forward each click.
                  const next = nextReminderFields(
                    reminder,
                    odometerByCar.get(reminder.carId) ?? 0,
                    today,
                  )
                  if (next) await addReminder(next)
                }}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 active:bg-green-50 dark:border-slate-600 dark:text-slate-300 dark:active:bg-green-950"
              >
                <Check className="h-4 w-4" strokeWidth={2.2} aria-hidden /> Done
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
