import type { EntryFields } from '../../db/entries'
import { pricePerLitre, roundMoney } from './entryValidation'

// The fast path: three numbers and a full-tank flag become a fuel entry, with
// price/litre derived and the date implicit. Kept separate from the full form's
// validator so "quick" genuinely means three inputs, not a stripped-down form.

export interface QuickFuelValues {
  odometer: string
  litres: string
  cost: string
  fullTank: boolean
}

export type QuickFuelErrors = Partial<Record<'odometer' | 'litres' | 'cost', string>>

export function emptyQuickFuel(): QuickFuelValues {
  return { odometer: '', litres: '', cost: '', fullTank: true }
}

const num = (s: string) => Number(s.trim().replace(',', '.'))

export function validateQuickFuel(
  values: QuickFuelValues,
  carId: string,
  todayISO: string,
): { fields?: EntryFields; errors: QuickFuelErrors } {
  const errors: QuickFuelErrors = {}

  const odometer = num(values.odometer)
  if (!values.odometer.trim()) errors.odometer = 'Odometer is required'
  else if (!Number.isFinite(odometer) || odometer < 0) errors.odometer = 'Must be 0 or more'

  const litres = num(values.litres)
  if (!values.litres.trim()) errors.litres = 'Litres are required'
  else if (!Number.isFinite(litres) || litres <= 0) errors.litres = 'Must be more than 0'

  const cost = num(values.cost)
  if (!values.cost.trim()) errors.cost = 'Cost is required'
  else if (!Number.isFinite(cost) || cost < 0) errors.cost = 'Must be 0 or more'

  if (Object.keys(errors).length > 0) return { errors }

  return {
    errors,
    fields: {
      carId,
      date: todayISO,
      odometer,
      cost: roundMoney(cost),
      category: 'fuel',
      litres,
      pricePerLitre: pricePerLitre(cost, litres),
      fullTank: values.fullTank,
    },
  }
}
