import { useState } from 'react'
import { useI18n, useT } from '../../i18n/I18nProvider'
import { localSetLabel } from './setLabel'
import { ArrowLeftRight, CloudSun, Package, Ruler, Snowflake, Sun, TriangleAlert } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Reminder, type TyreSeason, type TyreSet } from '../../db/db'
import { addTyreSet, deleteTyreSet, swapTyreSets, tyreSetsForCar, updateTyreSet } from '../../db/tyres'
import { describeDue, reminderStatus, type Translate } from '../reminders/reminderLogic'
import { describeSize, kmOnSet, latestTread, treadWarning } from './tyreLogic'
import { TyreSetForm } from './TyreSetForm'
import { TreadSheet } from './TreadSheet'

type View =
  | { mode: 'list' }
  | { mode: 'add' }
  | { mode: 'edit'; set: TyreSet }
  | { mode: 'tread'; set: TyreSet }
  | { mode: 'swap'; set: TyreSet }

const SEASON_ICON: Record<TyreSeason, typeof Sun> = {
  summer: Sun,
  winter: Snowflake,
  'all-season': CloudSun,
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TyresPanel({ carId, odometer }: { carId: string; odometer: number }) {
  const [view, setView] = useState<View>({ mode: 'list' })
  const tr = useI18n()
  const t = tr.t
  const sets = useLiveQuery(() => tyreSetsForCar(carId), [carId])
  const reminders = useLiveQuery(() => db.reminders.toArray(), [])

  if (sets === undefined || reminders === undefined) return null

  // Keep the open view in sync with live data (a tread reading changes the set)
  const refresh = (set: TyreSet) => sets.find((s) => s.id === set.id) ?? set

  if (view.mode === 'add' || view.mode === 'edit') {
    const editing = view.mode === 'edit' ? refresh(view.set) : undefined
    return (
      <section className="flex flex-col gap-3">
        <h2 className="section-title">{editing ? t('tyreForm.edit') : t('tyreForm.new')}</h2>
        <TyreSetForm
          carId={carId}
          set={editing}
          onSave={async (fields) => {
            try {
              if (editing) await updateTyreSet(editing.id, fields)
              else await addTyreSet(fields)
              setView({ mode: 'list' })
            } catch (err) {
              window.alert(`Saving failed: ${err instanceof Error ? err.message : String(err)}`)
            }
          }}
          onCancel={() => setView({ mode: 'list' })}
          onDelete={
            editing
              ? async () => {
                  if (window.confirm(t('tyres.confirmDelete'))) {
                    await deleteTyreSet(editing.id)
                    setView({ mode: 'list' })
                  }
                }
              : undefined
          }
        />
      </section>
    )
  }

  if (view.mode === 'tread') {
    return <TreadSheet set={refresh(view.set)} onDone={() => setView({ mode: 'list' })} />
  }

  if (view.mode === 'swap') {
    return (
      <SwapForm
        set={refresh(view.set)}
        odometer={odometer}
        onCancel={() => setView({ mode: 'list' })}
        onConfirm={async (date, odo) => {
          try {
            await swapTyreSets(carId, view.set.id, { date, odometer: odo })
            setView({ mode: 'list' })
          } catch (err) {
            window.alert(`Swap failed: ${err instanceof Error ? err.message : String(err)}`)
          }
        }}
      />
    )
  }

  const fitted = sets.find((s) => s.status === 'fitted')
  const stored = sets.filter((s) => s.status !== 'fitted')
  const ordered = fitted ? [fitted, ...stored] : stored
  const dueSwap = nextDueSwap(sets, reminders, odometer, tr)

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="section-title">{t('tyres.title')}</h2>
        <button type="button" onClick={() => setView({ mode: 'add' })} className="link-accent">
          + Add set
        </button>
      </div>

      {ordered.length === 0 ? (
        <p className="faint text-sm">
          {t('tyres.none')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordered.map((set) => (
            <TyreSetCard
              key={set.id}
              set={set}
              odometer={odometer}
              canSwap={set.status !== 'fitted'}
              onEdit={() => setView({ mode: 'edit', set })}
              onTread={() => setView({ mode: 'tread', set })}
              onSwap={() => setView({ mode: 'swap', set })}
            />
          ))}
        </ul>
      )}

      {dueSwap && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          {dueSwap}
        </p>
      )}
    </section>
  )
}

function TyreSetCard({
  set,
  odometer,
  canSwap,
  onEdit,
  onTread,
  onSwap,
}: {
  set: TyreSet
  odometer: number
  canSwap: boolean
  onEdit: () => void
  onTread: () => void
  onSwap: () => void
}) {
  const { locale } = useI18n()
  const t = useT()
  const Icon = SEASON_ICON[set.season]
  const tread = latestTread(set)
  const warning = treadWarning(set)
  const km = kmOnSet(set, odometer)

  return (
    <li className="card overflow-hidden">
      <button type="button" onClick={onEdit} className="flex w-full items-center gap-2.5 p-3 text-left">
        <Icon className="muted h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{localSetLabel(set, t)}</span>
          <span className="muted block truncate text-sm">{describeSize(set)}</span>
        </span>
        <span
          className={`shrink-0 rounded-lg px-2 py-1 text-xs font-medium ${
            set.status === 'fitted'
              ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
              : 'muted bg-slate-100 dark:bg-slate-800'
          }`}
        >
          {set.status === 'fitted' ? t('tyres.fitted') : t('tyres.stored')}
        </span>
      </button>

      <div className="muted flex flex-wrap gap-x-4 gap-y-1 px-3 pb-2.5 text-sm">
        <span className="flex items-center gap-1.5">
          <Ruler className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
          {tread ? `${tread.mm} mm` : 'No tread reading'}
        </span>
        {km > 0 && <span>{km.toLocaleString(locale)} km on set</span>}
        {set.storageLocation && set.status !== 'fitted' && (
          <span className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            {set.storageLocation}
          </span>
        )}
      </div>

      {warning && (
        <p className="px-3 pb-2.5 text-sm text-amber-700 dark:text-amber-400">
          {warning.mm} mm — under {warning.threshold} mm. Worth talking to a tyre shop.
        </p>
      )}

      <div className="flex border-t border-slate-100 text-sm dark:border-slate-800">
        <button type="button" onClick={onTread} className="link-accent flex-1 py-2.5">
          {t('tyres.logTread')}
        </button>
        {canSwap && (
          <button
            type="button"
            onClick={onSwap}
            className="link-accent flex flex-1 items-center justify-center gap-1.5 border-l border-slate-100 py-2.5 dark:border-slate-800"
          >
            <ArrowLeftRight className="h-4 w-4" strokeWidth={2} aria-hidden />
            {t('tyres.fitThisSet')}
          </button>
        )}
      </div>
    </li>
  )
}

function SwapForm({
  set,
  odometer,
  onConfirm,
  onCancel,
}: {
  set: TyreSet
  odometer: number
  onConfirm: (date: string, odometer: number) => void
  onCancel: () => void
}) {
  const t = useT()
  const [date, setDate] = useState(today())
  const [odo, setOdo] = useState(String(odometer))
  const value = Number(odo)
  const valid = Number.isFinite(value) && value >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(date)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="section-title">{t('tyres.fitHeading', { set: localSetLabel(set, t) })}</h2>
      <p className="faint text-sm">
        {t('tyres.swapNote')}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="label">{t('tyres.swappedOn')}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">{t('tyres.mileage')}</span>
          <input
            inputMode="numeric"
            value={odo}
            onChange={(e) => setOdo(e.target.value)}
            className="input"
          />
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!valid}
          onClick={() => onConfirm(date, value)}
          className="btn-primary disabled:opacity-50"
        >
          {t('tyres.confirmSwap')}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          {t('action.cancel')}
        </button>
      </div>
    </section>
  )
}

// The soonest swap reminder worth surfacing in context. It's the same
// Reminder the header bell shows — not a second notification system.
function nextDueSwap(
  sets: TyreSet[],
  reminders: Reminder[],
  odometer: number,
  tr: Translate,
): string | null {
  const ids = new Set(sets.map((s) => s.id))
  const open = reminders
    .filter((r) => r.tyreSetId !== undefined && ids.has(r.tyreSetId) && !r.completedAt)
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
  const next = open[0]
  if (!next) return null

  if (reminderStatus(next, odometer, today()) === 'upcoming') return null
  return `${next.title} — ${describeDue(next, odometer, today(), tr)}`
}
