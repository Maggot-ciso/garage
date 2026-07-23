import { useState } from 'react'
import { useT } from '../../i18n/I18nProvider'
import { errorText } from '../../i18n/fieldError'
import type { Car, Reminder } from '../../db/db'
import type { ReminderFields } from '../../db/reminders'
import {
  presetFormValues,
  REMINDER_PRESETS,
  validateReminder,
  type ReminderFormErrors,
  type ReminderFormValues,
} from './reminderLogic'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ReminderForm({
  cars,
  reminder,
  odometerFor,
  onSave,
  onCancel,
  onDelete,
}: {
  cars: Car[]
  reminder?: Reminder
  // Current odometer per car — presets prefill "due" from it
  odometerFor: (carId: string) => number
  onSave: (fields: ReminderFields) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const t = useT()
  const [carId, setCarId] = useState(reminder?.carId ?? cars[0]?.id ?? '')
  const [values, setValues] = useState<ReminderFormValues>({
    title: reminder?.title ?? '',
    dueDate: reminder?.dueDate ?? '',
    dueOdometer: reminder?.dueOdometer !== undefined ? String(reminder.dueOdometer) : '',
    repeatKm: reminder?.repeatKm !== undefined ? String(reminder.repeatKm) : '',
    repeatMonths: reminder?.repeatMonths !== undefined ? String(reminder.repeatMonths) : '',
    notes: reminder?.notes ?? '',
  })
  const [errors, setErrors] = useState<ReminderFormErrors>({})

  function set<K extends keyof ReminderFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = validateReminder(values, carId)
    setErrors(result.errors)
    if (result.fields) onSave(result.fields)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {!reminder && (
        <div className="flex flex-wrap gap-2">
          {REMINDER_PRESETS.map((preset) => (
            <button
              key={t(preset.label)}
              type="button"
              onClick={() => setValues(presetFormValues(preset, odometerFor(carId), today(), t))}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-600 active:bg-red-50 dark:border-slate-700 dark:text-slate-300 dark:active:bg-red-950"
            >
              {t(preset.label)}
            </button>
          ))}
        </div>
      )}

      {cars.length > 1 && (
        <label className="flex flex-col gap-1">
          <span className="label">{t('garage.vehicle')}</span>
          <select
            value={carId}
            onChange={(e) => setCarId(e.target.value)}
            className="input"
          >
            {cars.map((car) => (
              <option key={car.id} value={car.id}>
                {car.make} {car.model}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="label">{t('reminderForm.what')}</span>
        <input
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder={t('reminderForm.whatHint')}
          className={`input ${errors.title ? 'input-error' : ''}`}
        />
        {errors.title && (
          <span role="alert" className="error-text">
            {errorText(t, errors.title)}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="label">{t('reminderForm.dueKm')}</span>
        <input
          inputMode="numeric"
          value={values.dueOdometer}
          onChange={(e) => set('dueOdometer', e.target.value)}
          placeholder="165000"
          className={`input ${errors.dueOdometer ? 'input-error' : ''}`}
        />
        {errors.dueOdometer && (
          <span role="alert" className="error-text">
            {errorText(t, errors.dueOdometer)}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="label">{t('reminderForm.dueDate')}</span>
        <input
          type="date"
          value={values.dueDate}
          onChange={(e) => set('dueDate', e.target.value)}
          className={`input ${errors.dueDate ? 'input-error' : ''}`}
        />
        {errors.dueDate && (
          <span role="alert" className="error-text">
            {errorText(t, errors.dueDate)}
          </span>
        )}
      </label>

      <div className="flex flex-col gap-1">
        <span className="label">{t('reminderForm.repeats')}</span>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="faint text-xs">{t('reminderForm.repeatKmHint')}</span>
            <input
              inputMode="numeric"
              value={values.repeatKm}
              onChange={(e) => set('repeatKm', e.target.value)}
              placeholder="10000"
              aria-label={t('reminderForm.a11yRepeatKm')}
              className={`input ${errors.repeatKm ? 'input-error' : ''}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="faint text-xs">{t('reminderForm.repeatMonthsHint')}</span>
            <input
              inputMode="numeric"
              value={values.repeatMonths}
              onChange={(e) => set('repeatMonths', e.target.value)}
              placeholder="12"
              aria-label={t('reminderForm.a11yRepeatMonths')}
              className={`input ${errors.repeatMonths ? 'input-error' : ''}`}
            />
          </label>
        </div>
        {(errors.repeatKm || errors.repeatMonths) && (
          <span role="alert" className="error-text">
            {errorText(t, errors.repeatKm ?? errors.repeatMonths)}
          </span>
        )}
        <span className="faint text-sm">
          {t('reminderForm.repeatHint')}
        </span>
      </div>

      <label className="flex flex-col gap-1">
        <span className="label">{t('field.notes')}</span>
        <input value={values.notes} onChange={(e) => set('notes', e.target.value)} className="input" />
      </label>

      <div className="mt-2 flex flex-col gap-2">
        <button type="submit" className="btn-primary">
          {reminder ? t('reminderForm.saveChanges') : t('reminderForm.add')}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          {t('action.cancel')}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} className="btn-danger">
            {t('reminderForm.delete')}
          </button>
        )}
      </div>
    </form>
  )
}
