import type { CarFields } from '../../db/cars'

export interface CarFormValues {
  make: string
  model: string
  year: string
  engine: string
  vin: string
  odometer: string
}

export type CarFormErrors = Partial<Record<keyof CarFormValues, string>>

export interface ValidationResult {
  fields?: CarFields
  errors: CarFormErrors
}

export function validateCar(values: CarFormValues): ValidationResult {
  const errors: CarFormErrors = {}

  const make = values.make.trim()
  const model = values.model.trim()
  const engine = values.engine.trim()
  const vin = values.vin.trim().toUpperCase()

  if (!make) errors.make = 'Make is required'
  if (!model) errors.model = 'Model is required'

  const year = Number(values.year.trim())
  const maxYear = new Date().getFullYear() + 1
  if (!values.year.trim()) {
    errors.year = 'Year is required'
  } else if (!Number.isInteger(year) || year < 1900 || year > maxYear) {
    errors.year = `Year must be between 1900 and ${maxYear}`
  }

  const odometer = Number(values.odometer.trim())
  if (!values.odometer.trim()) {
    errors.odometer = 'Odometer is required'
  } else if (!Number.isFinite(odometer) || odometer < 0) {
    errors.odometer = 'Odometer must be 0 or more'
  }

  if (vin && !/^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin)) {
    errors.vin = 'VIN must be 11–17 characters (no I, O or Q)'
  }

  if (Object.keys(errors).length > 0) return { errors }

  return {
    errors,
    fields: {
      make,
      model,
      year,
      odometer,
      ...(engine ? { engine } : {}),
      ...(vin ? { vin } : {}),
    },
  }
}
