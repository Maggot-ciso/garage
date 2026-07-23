import { Car, Motorbike, type LucideIcon } from 'lucide-react'
import type { VehicleType } from '../db/db'
import type { TranslationKey } from '../i18n/en'

// Undefined means car — every vehicle saved before motorcycles existed is one.
export const VEHICLE_ICONS: Record<VehicleType, LucideIcon> = {
  car: Car,
  motorcycle: Motorbike,
}

// Keys, not text — see categoryIcons for why an English copy is a liability.
export const VEHICLE_LABELS: Record<VehicleType, TranslationKey> = {
  car: 'garage.car',
  motorcycle: 'garage.motorcycle',
}

export function vehicleIcon(type: VehicleType | undefined): LucideIcon {
  return VEHICLE_ICONS[type ?? 'car']
}
