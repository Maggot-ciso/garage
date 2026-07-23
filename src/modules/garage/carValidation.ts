import type { VehicleType } from '../../db/db'
import type { FieldError } from '../../i18n/fieldError'
import type { CarFields } from '../../db/cars'

export interface CarFormValues {
  vehicleType: VehicleType
  make: string
  model: string
  year: string
  engine: string
  vin: string
  odometer: string
}

// Translation keys, not sentences — see entryValidation.
export type CarFormErrors = Partial<Record<keyof CarFormValues, FieldError>>

export interface ValidationResult {
  fields?: CarFields
  errors: CarFormErrors
}

export function validateCar(values: CarFormValues): ValidationResult {
  const errors: CarFormErrors = {}
  const vehicleType = values.vehicleType

  const make = values.make.trim()
  const model = values.model.trim()
  const engine = values.engine.trim()
  const vin = values.vin.trim().toUpperCase()

  if (!make) errors.make = 'validate.makeRequired'
  if (!model) errors.model = 'validate.modelRequired'

  const year = Number(values.year.trim())
  const maxYear = new Date().getFullYear() + 1
  if (!values.year.trim()) {
    errors.year = 'validate.yearRequired'
  } else if (!Number.isInteger(year) || year < 1900 || year > maxYear) {
    errors.year = { key: 'validate.yearRange', vars: { max: maxYear } }
  }

  const odometer = Number(values.odometer.trim())
  if (!values.odometer.trim()) {
    errors.odometer = 'validate.odometerRequired'
  } else if (!Number.isFinite(odometer) || odometer < 0) {
    errors.odometer = 'validate.odometerMin'
  }

  if (vin && !/^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin)) {
    errors.vin = 'validate.vinFormat'
  }

  if (Object.keys(errors).length > 0) return { errors }

  return {
    errors,
    fields: {
      vehicleType,
      make,
      model,
      year,
      odometer,
      ...(engine ? { engine } : {}),
      ...(vin ? { vin } : {}),
    },
  }
}
