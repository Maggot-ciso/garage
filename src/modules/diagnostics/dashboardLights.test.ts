import { describe, expect, it } from 'vitest'
import { DASHBOARD_LIGHTS } from '../../data/dashboardLights'
import { colourCounts, COLOUR_ORDER, lightById, lightsFor, lightsOfColour } from './dashboardLights'

describe('dashboard light table integrity', () => {
  it('every light has a non-empty svg and a unique id', () => {
    const ids = new Set<string>()
    for (const l of DASHBOARD_LIGHTS) {
      expect(l.svg).toMatch(/</) // has markup
      expect(l.meaning.length).toBeGreaterThan(10)
      expect(l.whatToDo.length).toBeGreaterThan(10)
      expect(ids.has(l.id)).toBe(false)
      ids.add(l.id)
    }
  })

  it('every light belongs to one of the three colours', () => {
    for (const l of DASHBOARD_LIGHTS) {
      expect(COLOUR_ORDER).toContain(l.colour)
    }
  })

  it('the svg never carries a hard-coded colour — it inherits currentColor', () => {
    for (const l of DASHBOARD_LIGHTS) {
      expect(l.svg).not.toMatch(/#[0-9a-f]{3,6}/i)
      expect(l.svg).toContain('currentColor')
    }
  })
})

describe('lightsOfColour', () => {
  it('returns only that colour, sorted by name', () => {
    const red = lightsOfColour('red')
    expect(red.every((l) => l.colour === 'red')).toBe(true)
    const names = red.map((l) => l.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  it('has at least the essential red lights', () => {
    const redIds = lightsOfColour('red').map((l) => l.id)
    expect(redIds).toEqual(expect.arrayContaining(['oil-pressure', 'coolant-temp', 'brake-system']))
  })
})

describe('lightById', () => {
  it('finds a light', () => {
    expect(lightById('check-engine')?.name).toBe('Check engine')
  })

  it('is undefined for an unknown id', () => {
    expect(lightById('nope')).toBeUndefined()
  })
})

describe('colourCounts', () => {
  it('sums to everything shown for that vehicle', () => {
    for (const type of ['car', 'motorcycle'] as const) {
      const c = colourCounts(type)
      expect(c.red + c.amber + c.info).toBe(lightsFor(type).length)
    }
  })

  it('accounts for every light across both vehicle types', () => {
    const seen = new Set([...lightsFor('car'), ...lightsFor('motorcycle')].map((l) => l.id))
    expect(seen.size).toBe(DASHBOARD_LIGHTS.length)
  })
})

// Showing a scooter rider the airbag lamp is noise; hiding the neutral lamp
// from them is a gap. Both were true before this filter existed.
describe('lights are filtered to the vehicle', () => {
  it('keeps car-only lights away from a motorcycle', () => {
    const bikeIds = lightsFor('motorcycle').map((l) => l.id)
    expect(bikeIds).not.toContain('airbag')
    expect(bikeIds).not.toContain('door-open')
    expect(bikeIds).not.toContain('seatbelt')
  })

  it('keeps bike-only lights away from a car', () => {
    const carIds = lightsFor('car').map((l) => l.id)
    expect(carIds).not.toContain('neutral')
    expect(carIds).not.toContain('side-stand')
    expect(carIds).not.toContain('fi-fault')
  })

  it('gives a motorcycle the lights it actually has', () => {
    const bikeIds = lightsFor('motorcycle').map((l) => l.id)
    expect(bikeIds).toEqual(expect.arrayContaining(['neutral', 'side-stand', 'fi-fault']))
    // shared ones still appear
    expect(bikeIds).toEqual(expect.arrayContaining(['oil-pressure', 'abs', 'low-fuel']))
  })

  // Vehicles saved before vehicleType existed are cars, and must not lose lights.
  it('treats an untyped vehicle as a car', () => {
    expect(lightsFor(undefined).map((l) => l.id)).toEqual(lightsFor('car').map((l) => l.id))
  })
})
