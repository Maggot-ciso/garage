import type { EntryFields } from '../../db/entries'
import type { TranslationKey } from '../../i18n/en'
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

// Translation keys, not sentences — see entryValidation.
export type QuickFuelErrors = Partial<
  Record<'odometer' | 'litres' | 'cost', TranslationKey>
>

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
  if (!values.odometer.trim()) errors.odometer = 'validate.odometerRequired'
  else if (!Number.isFinite(odometer) || odometer < 0) errors.odometer = 'validate.min0'

  const litres = num(values.litres)
  if (!values.litres.trim()) errors.litres = 'validate.litresRequiredShort'
  else if (!Number.isFinite(litres) || litres <= 0) errors.litres = 'validate.moreThan0'

  const cost = num(values.cost)
  if (!values.cost.trim()) errors.cost = 'validate.costRequired'
  else if (!Number.isFinite(cost) || cost < 0) errors.cost = 'validate.min0'

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
