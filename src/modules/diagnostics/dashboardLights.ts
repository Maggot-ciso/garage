import {
  DASHBOARD_LIGHTS,
  type DashboardLight,
  type LightColour,
} from '../../data/dashboardLights'
import type { VehicleType } from '../../db/db'

export const COLOUR_ORDER: LightColour[] = ['red', 'amber', 'info']

export const COLOUR_LABEL: Record<LightColour, string> = {
  red: 'Red',
  amber: 'Amber / yellow',
  info: 'Green / blue',
}

export const COLOUR_HINT: Record<LightColour, string> = {
  red: 'Stop or act now',
  amber: 'Attention needed soon',
  info: 'Information only',
}

// A scooter has no airbag and no doors; a car has no neutral lamp or side
// stand. Showing the wrong half is noise in a screen whose whole job is to
// help someone identify one symbol quickly.
export function lightsFor(vehicleType: VehicleType | undefined): DashboardLight[] {
  const kind: VehicleType = vehicleType ?? 'car'
  return DASHBOARD_LIGHTS.filter((l) => l.fits === 'both' || l.fits === kind)
}

export function lightsOfColour(
  colour: LightColour,
  vehicleType?: VehicleType,
): DashboardLight[] {
  return lightsFor(vehicleType)
    .filter((l) => l.colour === colour)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function lightById(id: string): DashboardLight | undefined {
  return DASHBOARD_LIGHTS.find((l) => l.id === id)
}

export function colourCounts(vehicleType?: VehicleType): Record<LightColour, number> {
  return {
    red: lightsOfColour('red', vehicleType).length,
    amber: lightsOfColour('amber', vehicleType).length,
    info: lightsOfColour('info', vehicleType).length,
  }
}
