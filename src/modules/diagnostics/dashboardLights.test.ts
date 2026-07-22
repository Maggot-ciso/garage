import { describe, expect, it } from 'vitest'
import { DASHBOARD_LIGHTS } from '../../data/dashboardLights'
import { colourCounts, COLOUR_ORDER, lightById, lightsOfColour } from './dashboardLights'

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
  it('sums to the whole table', () => {
    const c = colourCounts()
    expect(c.red + c.amber + c.info).toBe(DASHBOARD_LIGHTS.length)
  })
})
