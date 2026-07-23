import { useState } from 'react'
import { VEHICLE_TYPES, type Car } from '../../db/db'
import type { CarFields } from '../../db/cars'
import { Combobox } from '../../components/Combobox'
import { makesForVehicleType, modelsForVehicle } from '../../data/carModels'
import { validateCar, type CarFormErrors, type CarFormValues } from './carValidation'
import { decodeVinLocally } from './vinDecode'
import { lookupVin } from './vinLookup'
import { VEHICLE_ICONS, VEHICLE_LABELS } from '../../components/vehicleIcons'
import { useT } from '../../i18n/I18nProvider'
import { errorText } from '../../i18n/fieldError'

const FIELDS: {
  name: keyof CarFormValues
  label: string
  inputMode?: 'numeric'
  placeholder?: string
}[] = [
  { name: 'year', label: 'Year', inputMode: 'numeric', placeholder: '2018' },
  { name: 'engine', label: 'Engine (optional)', placeholder: '2.0 TDI' },
  { name: 'vin', label: 'VIN (optional)', placeholder: 'TMBJJ7NE4J0123456' },
  { name: 'odometer', label: 'Odometer (km)', inputMode: 'numeric', placeholder: '154000' },
]

export function CarForm({
  car,
  onSave,
  onCancel,
  onDelete,
}: {
  car?: Car
  onSave: (fields: CarFields) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const t = useT()
  const [values, setValues] = useState<CarFormValues>({
    vehicleType: car?.vehicleType ?? 'car',
    make: car?.make ?? '',
    model: car?.model ?? '',
    year: car ? String(car.year) : '',
    engine: car?.engine ?? '',
    vin: car?.vin ?? '',
    odometer: car ? String(car.odometer) : '',
  })
  const [errors, setErrors] = useState<CarFormErrors>({})
  const [decoding, setDecoding] = useState(false)
  const [vinNote, setVinNote] = useState<string | null>(null)
  const [suggestedVin, setSuggestedVin] = useState<string | null>(null)

  // Offline decode first — manufacturer, country and year come from the VIN's
  // own structure. The network lookup only adds model and engine, and only for
  // US-market cars, so this stays useful with no connection at all.
  async function decodeVin(raw: string) {
    const vin = raw.trim()
    if (!vin) return
    setDecoding(true)
    setVinNote(null)
    setSuggestedVin(null)
    try {
      const local = decodeVinLocally(vin)
      if (local.problem === 'length' || local.problem === 'characters') {
        setVinNote(
          local.problem === 'length'
            ? `A VIN is 17 characters — that one is ${local.vin.length}.`
            : 'That VIN contains characters a VIN never uses (I, O or Q).',
        )
        return
      }

      // Work out what changed BEFORE touching state — a state updater must be
      // pure, so it is the wrong place to accumulate a list as a side effect.
      const remote = await lookupVin(local.vin)
      const resolved = {
        make: remote?.make ?? local.make,
        model: remote?.model,
        year: remote?.year ?? local.year,
        engine: remote?.engine,
      }
      const filled = (['make', 'model', 'year', 'engine'] as const).filter(
        (key) => resolved[key] !== undefined && String(resolved[key]) !== '',
      )

      setValues((v) => ({
        ...v,
        vin: local.vin,
        ...(resolved.make ? { make: resolved.make } : {}),
        ...(resolved.model ? { model: resolved.model } : {}),
        ...(resolved.year !== undefined ? { year: String(resolved.year) } : {}),
        ...(resolved.engine ? { engine: resolved.engine } : {}),
      }))

      if (local.problem === 'check-digit' && local.suggestedVin) {
        setSuggestedVin(local.suggestedVin)
      }
      const where = local.country ? ` Built in ${local.country}.` : ''
      setVinNote(
        filled.length > 0
          ? `Filled ${filled.join(', ')}.${where}`
          : `Nothing to fill from that VIN.${where}`,
      )
    } finally {
      setDecoding(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = validateCar(values)
    setErrors(result.errors)
    if (result.fields) onSave(result.fields)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <span className="label">{t('carForm.vehicle')}</span>
        <div className="grid grid-cols-2 gap-2">
          {VEHICLE_TYPES.map((type) => {
            const Icon = VEHICLE_ICONS[type]
            const selected = values.vehicleType === type
            return (
              <button
                key={type}
                type="button"
                onClick={() =>
                  setValues((v) =>
                    v.vehicleType === type
                      ? v
                      : // Switching type invalidates the make/model — a Škoda
                        // scooter is not a thing, so clear rather than carry over.
                        { ...v, vehicleType: type, make: '', model: '' },
                  )
                }
                aria-pressed={selected}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-sm ${
                  selected
                    ? 'border-red-500 bg-red-50 font-semibold text-red-700 dark:bg-red-950 dark:text-red-300'
                    : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                {VEHICLE_LABELS[type]}
              </button>
            )
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="label">{t('garage.make')}</span>
        <Combobox
          value={values.make}
          onChange={(make) => setValues((v) => ({ ...v, make }))}
          options={makesForVehicleType(values.vehicleType)}
          placeholder="Škoda"
          hasError={Boolean(errors.make)}
        />
        {errors.make && (
          <span role="alert" className="error-text">
            {errorText(t, errors.make)}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="label">{t('garage.model')}</span>
        <Combobox
          value={values.model}
          onChange={(model) => setValues((v) => ({ ...v, model }))}
          options={modelsForVehicle(values.vehicleType, values.make)}
          placeholder="Octavia"
          hasError={Boolean(errors.model)}
        />
        {errors.model && (
          <span role="alert" className="error-text">
            {errorText(t, errors.model)}
          </span>
        )}
      </label>

      {FIELDS.map((field) => (
        <label key={field.name} className="flex flex-col gap-1">
          <span className="label">{field.label}</span>
          <input
            name={field.name}
            value={values[field.name]}
            inputMode={field.inputMode}
            placeholder={field.placeholder}
            onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            className={`input ${errors[field.name] ? 'input-error' : ''}`}
          />
          {errors[field.name] && (
            <span role="alert" className="error-text">
              {errorText(t, errors[field.name])}
            </span>
          )}
          {field.name === 'vin' && (
            <>
              <button
                type="button"
                disabled={decoding || !values.vin.trim()}
                onClick={() => void decodeVin(values.vin)}
                className="link-accent self-start disabled:opacity-50"
              >
                {decoding ? t('garage.decoding') : t('garage.decodeVin')}
              </button>
              {vinNote && <span className="faint text-sm">{vinNote}</span>}
              {suggestedVin && (
                <button
                  type="button"
                  onClick={() => void decodeVin(suggestedVin)}
                  className="link-accent self-start text-left"
                >
                  {t('carForm.vinCheckDigit', { vin: suggestedVin })}
                </button>
              )}
            </>
          )}
        </label>
      ))}

      <div className="mt-2 flex flex-col gap-2">
        <button type="submit" className="btn-primary">
          {car ? t('action.save') : t('garage.addVehicle')}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          {t('action.cancel')}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} className="btn-danger">
            {t('carForm.delete')}
          </button>
        )}
      </div>
    </form>
  )
}
