import { useState } from 'react'
import { Fuel } from 'lucide-react'
import type { EntryFields } from '../../db/entries'
import { odometerWarning } from './entryValidation'
import { useT } from '../../i18n/I18nProvider'
import {
  emptyQuickFuel,
  validateQuickFuel,
  type QuickFuelErrors,
  type QuickFuelValues,
} from './quickFuel'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function QuickFuelSheet({
  carId,
  suggestedOdometer,
  history,
  onSave,
  onCancel,
}: {
  carId: string
  suggestedOdometer?: number
  history?: { date: string; odometer: number }[]
  onSave: (fields: EntryFields) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<QuickFuelValues>(emptyQuickFuel())
  const [errors, setErrors] = useState<QuickFuelErrors>({})
  const t = useT()

  function set<K extends keyof QuickFuelValues>(key: K, value: QuickFuelValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  const odoNote =
    history && values.odometer.trim()
      ? odometerWarning({ date: today(), odometer: Number(values.odometer.trim()) }, history)
      : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = validateQuickFuel(values, carId, today())
    setErrors(result.errors)
    if (result.fields) onSave(result.fields)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <h2 className="section-title flex items-center gap-2">
        <Fuel className="h-4 w-4" strokeWidth={1.8} aria-hidden /> {t('quickFuel.title')}
      </h2>

      <label className="flex flex-col gap-1">
        <span className="label">{t('field.odometer')}</span>
        <input
          inputMode="numeric"
          autoFocus
          value={values.odometer}
          onChange={(e) => set('odometer', e.target.value)}
          placeholder={suggestedOdometer ? String(suggestedOdometer) : '152000'}
          className={`input ${errors.odometer ? 'input-error' : ''}`}
        />
        {errors.odometer && <span role="alert" className="error-text">{t(errors.odometer)}</span>}
        {!errors.odometer && odoNote && (
          <span className="text-sm text-amber-700 dark:text-amber-400">{t(odoNote.key, odoNote.vars)}</span>
        )}
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="label">{t('field.litres')}</span>
          <input
            inputMode="decimal"
            value={values.litres}
            onChange={(e) => set('litres', e.target.value)}
            placeholder="42.10"
            className={`input ${errors.litres ? 'input-error' : ''}`}
          />
          {errors.litres && <span role="alert" className="error-text">{t(errors.litres)}</span>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">{t('field.totalCost')}</span>
          <input
            inputMode="decimal"
            value={values.cost}
            onChange={(e) => set('cost', e.target.value)}
            placeholder="69.55"
            className={`input ${errors.cost ? 'input-error' : ''}`}
          />
          {errors.cost && <span role="alert" className="error-text">{t(errors.cost)}</span>}
        </label>
      </div>

      <label className="card flex items-center gap-3 p-3">
        <input
          type="checkbox"
          checked={values.fullTank}
          onChange={(e) => set('fullTank', e.target.checked)}
          className="h-5 w-5 accent-red-600"
        />
        <span>
          <span className="font-medium">{t('field.fullTank')}</span>
          <span className="faint block text-sm">{t('field.fullTankHint')}</span>
        </span>
      </label>

      <div className="mt-1 flex flex-col gap-2">
        <button type="submit" className="btn-primary">{t('quickFuel.save')}</button>
        <button type="button" onClick={onCancel} className="btn-secondary">{t('action.cancel')}</button>
      </div>
    </form>
  )
}
