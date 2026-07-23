import { useState } from 'react'
import { useT } from '../../i18n/I18nProvider'
import { localSetLabel } from './setLabel'
import { Trash2 } from 'lucide-react'
import type { TyreSet } from '../../db/db'
import { addTreadReading, deleteTreadReading } from '../../db/tyres'
import { validateTread, type TreadFormErrors } from './tyreLogic'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TreadSheet({ set, onDone }: { set: TyreSet; onDone: () => void }) {
  const t = useT()
  const [date, setDate] = useState(today())
  const [mm, setMm] = useState('')
  const [errors, setErrors] = useState<TreadFormErrors>({})

  const history = [...set.treadReadings].sort((a, b) => b.date.localeCompare(a.date))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = validateTread(date, mm)
    setErrors(result.errors)
    if (!result.reading) return
    await addTreadReading(set.id, result.reading)
    setMm('')
    onDone()
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="section-title">{t('tyres.treadHeading', { set: localSetLabel(set, t) })}</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="label">{t('tread.measuredOn')}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`input ${errors.date ? 'input-error' : ''}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">{t('tread.depth')}</span>
            <input
              inputMode="decimal"
              value={mm}
              onChange={(e) => setMm(e.target.value)}
              placeholder="5.5"
              className={`input ${errors.mm ? 'input-error' : ''}`}
            />
          </label>
        </div>
        {(errors.date || errors.mm) && (
          <span role="alert" className="error-text">
            {errors.date ?? errors.mm}
          </span>
        )}
        <div className="flex flex-col gap-2">
          <button type="submit" className="btn-primary">
            {t('tread.save')}
          </button>
          <button type="button" onClick={onDone} className="btn-secondary">
            Back
          </button>
        </div>
      </form>

      {history.length > 0 && (
        <ul className="card divide-y divide-slate-100 dark:divide-slate-800">
          {history.map((reading, index) => (
            <li
              key={`${reading.date}-${reading.mm}-${index}`}
              className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <span className="muted">{reading.date}</span>
              <span className="flex-1 text-right font-medium">{reading.mm} mm</span>
              <button
                type="button"
                aria-label={t('tread.confirmDelete', { date: reading.date })}
                onClick={async () => {
                  try {
                    await deleteTreadReading(set.id, reading)
                  } catch (err) {
                    window.alert(
                      t('error.deletingFailed', {
                        reason: err instanceof Error ? err.message : String(err),
                      }),
                    )
                  }
                }}
                className="muted shrink-0 p-1"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
