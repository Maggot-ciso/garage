import { useState } from 'react'
import { useT } from '../../i18n/I18nProvider'
import { errorText } from '../../i18n/fieldError'
import type { TranslationKey } from '../../i18n/en'
import { TYRE_SEASONS, type TyreSeason, type TyreSet } from '../../db/db'
import type { TyreSetFields } from '../../db/tyres'
import {
  emptyTyreForm,
  MONTH_NAMES,
  tyreFormValues,
  validateTyreSet,
  type TyreFormErrors,
  type TyreFormValues,
} from './tyreLogic'

const DEFAULT_SWAP_MONTH: Record<TyreSeason, string> = {
  summer: '4',
  winter: '10',
  'all-season': '',
}

export function TyreSetForm({
  carId,
  set,
  onSave,
  onCancel,
  onDelete,
}: {
  carId: string
  set?: TyreSet
  onSave: (fields: TyreSetFields) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const t = useT()
  const [values, setValues] = useState<TyreFormValues>(
    set ? tyreFormValues(set) : { ...emptyTyreForm(), swapMonth: DEFAULT_SWAP_MONTH.summer },
  )
  const [errors, setErrors] = useState<TyreFormErrors>({})

  function update<K extends keyof TyreFormValues>(key: K, value: TyreFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  // Changing season on a new set moves the swap month with it — April for
  // summer, October for winter — but never overrides a month already chosen.
  function pickSeason(season: TyreSeason) {
    setValues((v) => ({
      ...v,
      season,
      swapMonth: set ? v.swapMonth : DEFAULT_SWAP_MONTH[season],
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = validateTyreSet(values)
    setErrors(result.errors)
    if (result.fields) onSave({ carId, ...result.fields })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <span className="label">{t('tyreForm.season')}</span>
        <div className="flex flex-wrap gap-2">
          {TYRE_SEASONS.map((season) => (
            <button
              key={season}
              type="button"
              onClick={() => pickSeason(season)}
              aria-pressed={values.season === season}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                values.season === season
                  ? 'border-red-600 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950 dark:text-red-300'
                  : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              {t(`season.${season}` as TranslationKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="label">{t('tyreForm.brand')}</span>
          <input
            value={values.brand}
            onChange={(e) => update('brand', e.target.value)}
            placeholder="Michelin"
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">{t('tyreForm.model')}</span>
          <input
            value={values.model}
            onChange={(e) => update('model', e.target.value)}
            placeholder="Pilot Sport 4"
            className="input"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="label">{t('tyreForm.size')}</span>
        <input
          value={values.size}
          onChange={(e) => update('size', e.target.value)}
          placeholder="225/40 R19"
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="label">{t('tyreForm.swapMonth')}</span>
        <select
          value={values.swapMonth}
          onChange={(e) => update('swapMonth', e.target.value)}
          className={`input ${errors.swapMonth ? 'input-error' : ''}`}
        >
          <option value="">{t('tyreForm.noSwapReminder')}</option>
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={String(index + 1)}>
              {name}
            </option>
          ))}
        </select>
        {errors.swapMonth && (
          <span role="alert" className="error-text">
            {errorText(t, errors.swapMonth)}
          </span>
        )}
        <span className="faint text-sm">
          A reminder is scheduled for the 1st of that month whenever this set comes off.
        </span>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="label">{t('tyreForm.boughtOn')}</span>
          <input
            type="date"
            value={values.purchaseDate}
            onChange={(e) => update('purchaseDate', e.target.value)}
            className={`input ${errors.purchaseDate ? 'input-error' : ''}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">{t('tyreForm.atMileage')}</span>
          <input
            inputMode="numeric"
            value={values.purchaseOdometer}
            onChange={(e) => update('purchaseOdometer', e.target.value)}
            placeholder="130000"
            className={`input ${errors.purchaseOdometer ? 'input-error' : ''}`}
          />
        </label>
      </div>
      {(errors.purchaseDate || errors.purchaseOdometer) && (
        <span role="alert" className="error-text">
          {errorText(t, errors.purchaseDate ?? errors.purchaseOdometer)}
        </span>
      )}

      <label className="flex flex-col gap-1">
        <span className="label">{t('tyreForm.storedWhere')}</span>
        <input
          value={values.storageLocation}
          onChange={(e) => update('storageLocation', e.target.value)}
          placeholder={t('tyreForm.storedWhereHint')}
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="label">{t('field.notes')}</span>
        <input
          value={values.notes}
          onChange={(e) => update('notes', e.target.value)}
          className="input"
        />
      </label>

      <div className="mt-2 flex flex-col gap-2">
        <button type="submit" className="btn-primary">
          {set ? t('tyreForm.saveChanges') : t('tyreForm.add')}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          {t('action.cancel')}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} className="btn-danger">
            {t('tyreForm.delete')}
          </button>
        )}
      </div>
    </form>
  )
}
