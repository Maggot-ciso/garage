import { DASHBOARD_LIGHTS, type DashboardLight, type LightColour } from '../../data/dashboardLights'

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

export function lightsOfColour(colour: LightColour): DashboardLight[] {
  return DASHBOARD_LIGHTS.filter((l) => l.colour === colour).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}

export function lightById(id: string): DashboardLight | undefined {
  return DASHBOARD_LIGHTS.find((l) => l.id === id)
}

export function colourCounts(): Record<LightColour, number> {
  return {
    red: lightsOfColour('red').length,
    amber: lightsOfColour('amber').length,
    info: lightsOfColour('info').length,
  }
}
