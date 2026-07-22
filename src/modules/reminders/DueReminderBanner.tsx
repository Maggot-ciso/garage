import { TriangleAlert } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { openReminders } from '../../db/reminders'
import { currentOdometer, describeDue, sortReminders } from './reminderLogic'

const SHOWN = 3

// Sideloaded builds can never send a push notification, so a reminder is only
// ever seen when the app is open. Hiding them behind the header bell means the
// owner has to already suspect something is due — which defeats the point.
// Anything due or nearly due surfaces on the first screen instead.
export function DueReminderBanner({ onOpen }: { onOpen: () => void }) {
  const data = useLiveQuery(async () => {
    const [cars, entries, reminders] = await Promise.all([
      db.cars.toArray(),
      db.entries.toArray(),
      openReminders(),
    ])
    return { cars, entries, reminders }
  }, [])

  if (!data) return null
  const { cars, entries, reminders } = data
  if (reminders.length === 0) return null

  const today = new Date().toISOString().slice(0, 10)
  const odometerByCar = new Map(cars.map((car) => [car.id, currentOdometer(car, entries)]))
  const pressing = sortReminders(reminders, odometerByCar, today).filter(
    ({ status }) => status === 'due' || status === 'soon',
  )
  if (pressing.length === 0) return null

  const anyDue = pressing.some(({ status }) => status === 'due')
  const tone = anyDue
    ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
    : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full flex-col gap-1.5 rounded-xl border p-3 text-left ${tone}`}
    >
      <span className="flex items-center gap-2 font-medium">
        <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        {anyDue
          ? `${pressing.filter(({ status }) => status === 'due').length} due now`
          : 'Coming up soon'}
      </span>
      {pressing.slice(0, SHOWN).map(({ reminder, status }) => (
        <span key={reminder.id} className="text-sm opacity-90">
          {reminder.title} — {status === 'due' ? 'due ' : ''}
          {describeDue(reminder, odometerByCar.get(reminder.carId) ?? 0, today)}
        </span>
      ))}
      {pressing.length > SHOWN && (
        <span className="text-sm opacity-75">+{pressing.length - SHOWN} more</span>
      )}
    </button>
  )
}
