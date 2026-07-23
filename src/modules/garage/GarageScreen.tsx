import { useState } from 'react'
import { Car as CarIcon, Save } from 'lucide-react'
import { vehicleIcon } from '../../components/vehicleIcons'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Car } from '../../db/db'
import { addCar, deleteCar, updateCar, type CarFields } from '../../db/cars'
import { resolveActiveCar, setActiveCar } from '../../db/activeCar'
import type { TabId } from '../../components/TabBar'
import { CarDetailScreen } from './CarDetailScreen'
import { CarForm } from './CarForm'
import { getSetting, SETTING_KEYS } from '../../db/settings'
import { daysSince } from '../../db/backup'
import { DueReminderBanner } from '../reminders/DueReminderBanner'
import { useI18n, useT } from '../../i18n/I18nProvider'
import type { TranslationKey } from '../../i18n/en'

const NUDGE_AFTER_DAYS = 30

// Surfaces storage failures (quota, blocked IndexedDB, …) that would
// otherwise vanish into an unhandled rejection and look like a dead button.
// Outside the component, so it takes the translator the same way the other
// pure helpers do.
async function trySave(
  action: () => Promise<void>,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
) {
  try {
    await action()
  } catch (err) {
    window.alert(
      t('error.savingFailed', { reason: err instanceof Error ? err.message : String(err) }),
    )
  }
}

type View =
  | { mode: 'list' }
  | { mode: 'add' }
  | { mode: 'detail'; carId: string }
  | { mode: 'edit'; car: Car }

export function GarageScreen({
  onOpenTab,
  onOpenReminders,
}: {
  onOpenTab: (tab: TabId) => void
  onOpenReminders: () => void
}) {
  const t = useT()
  const { locale } = useI18n()
  const [view, setView] = useState<View>({ mode: 'list' })
  const state = useLiveQuery(resolveActiveCar, [])

  if (state === undefined) return null
  const { cars, car: activeCar } = state

  if (view.mode === 'add') {
    return (
      <CarForm
        onSave={(fields: CarFields) =>
          trySave(async () => {
            await addCar(fields)
            setView({ mode: 'list' })
          }, t)
        }
        onCancel={() => setView({ mode: 'list' })}
      />
    )
  }

  if (view.mode === 'detail') {
    const car = cars.find((c) => c.id === view.carId)
    if (car) {
      return (
        <CarDetailScreen
          car={car}
          onBack={() => setView({ mode: 'list' })}
          onEdit={() => setView({ mode: 'edit', car })}
          onOpenTab={onOpenTab}
        />
      )
    }
    // car was deleted — fall through to the list
  }

  if (view.mode === 'edit') {
    return (
      <CarForm
        car={view.car}
        onSave={(fields: CarFields) =>
          trySave(async () => {
            await updateCar(view.car.id, fields)
            setView({ mode: 'detail', carId: view.car.id })
          }, t)
        }
        onCancel={() => setView({ mode: 'detail', carId: view.car.id })}
        onDelete={async () => {
          if (window.confirm(t('garage.confirmDelete', { name: `${view.car.make} ${view.car.model}` }))) {
            await deleteCar(view.car.id)
            setView({ mode: 'list' })
          }
        }}
      />
    )
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <DueReminderBanner onOpen={onOpenReminders} />

      {cars.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <CarIcon className="faint h-10 w-10" strokeWidth={1.5} aria-hidden />
          <h2 className="text-base font-semibold">{t('garage.noCars')}</h2>
          <p className="muted max-w-xs text-sm">
            {t('garage.noCarsHint')}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {cars.map((car) => (
            <li
              key={car.id}
              className={`card flex items-stretch ${
                cars.length > 1 && car.id === activeCar?.id
                  ? 'ring-2 ring-red-500/70'
                  : ''
              }`}
            >
              {/* Tap the card → make it the active car and open its overview */}
              <button
                type="button"
                onClick={async () => {
                  await setActiveCar(car.id)
                  setView({ mode: 'detail', carId: car.id })
                }}
                className="min-w-0 flex-1 rounded-2xl p-4 text-left active:bg-slate-50 dark:active:bg-slate-800"
              >
                <div className="flex items-baseline justify-between">
                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                    {(() => {
                      const Icon = vehicleIcon(car.vehicleType)
                      return <Icon className="muted h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
                    })()}
                    <span className="truncate">
                      {car.make} {car.model}
                    </span>
                  </span>
                  <span className="muted ml-2 shrink-0 text-sm">{car.year}</span>
                </div>
                <div className="muted mt-1 text-sm">
                  {car.odometer.toLocaleString(locale)} km
                  {car.engine ? ` · ${car.engine}` : ''}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={() => setView({ mode: 'add' })} className="btn-primary">
        {t('garage.addVehicle')}
      </button>

      <BackupNudge />
    </div>
  )
}

// iOS can evict PWA storage after long inactivity — quietly keep the owner
// in the habit of exporting once their logbook holds anything worth losing.
function BackupNudge() {
  const t = useT()
  const nudge = useLiveQuery(async () => {
    const entryCount = await db.entries.count()
    if (entryCount === 0) return null
    const days = daysSince(await getSetting(SETTING_KEYS.lastBackupAt))
    if (days === null) return t('garage.noBackupYet')
    if (days > NUDGE_AFTER_DAYS) return t('garage.backupNudge', { days })
    return null
    // t is a dependency: the nudge text has to follow a language switch.
  }, [t])

  if (!nudge) return null
  return (
    <p className="notice-amber mt-2 flex items-start gap-2">
      <Save className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      <span>
        {nudge} — iOS can wipe app storage after long inactivity. Settings → Export backup.
      </span>
    </p>
  )
}
