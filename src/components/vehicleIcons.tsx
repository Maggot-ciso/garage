import { Car, Motorbike, type LucideIcon } from 'lucide-react'
import type { VehicleType } from '../db/db'

// Undefined means car — every vehicle saved before motorcycles existed is one.
export const VEHICLE_ICONS: Record<VehicleType, LucideIcon> = {
  car: Car,
  motorcycle: Motorbike,
}

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  car: 'Car',
  motorcycle: 'Motorcycle / scooter',
}

export function vehicleIcon(type: VehicleType | undefined): LucideIcon {
  return VEHICLE_ICONS[type ?? 'car']
}
