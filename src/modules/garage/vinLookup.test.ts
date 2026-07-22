import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookupVin, titleCase } from './vinLookup'

const OCTAVIA = 'TMBJG7NE0J0123456'
const GENESIS = 'KMHHU61HXBU100001'

function stubFetch(payload: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => payload })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('titleCase', () => {
  it('tames NHTSA shouting', () => {
    expect(titleCase('HYUNDAI')).toBe('Hyundai')
    expect(titleCase('LAND ROVER')).toBe('Land Rover')
  })
})

describe('lookupVin', () => {
  it('does not touch the network for a car NHTSA cannot know', async () => {
    const fetchMock = stubFetch({})
    expect(await lookupVin(OCTAVIA)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps a US-market response onto car fields', async () => {
    stubFetch({
      Results: [
        {
          Make: 'HYUNDAI',
          Model: 'Genesis Coupe',
          ModelYear: '2011',
          DisplacementL: '3.8',
          EngineCylinders: '6',
        },
      ],
    })
    expect(await lookupVin(GENESIS)).toEqual({
      make: 'Hyundai',
      model: 'Genesis Coupe',
      year: 2011,
      engine: '3.8L V6',
    })
  })

  it('omits the engine when the database has no displacement', async () => {
    stubFetch({ Results: [{ Make: 'HYUNDAI', ModelYear: '2011' }] })
    expect(await lookupVin(GENESIS)).toEqual({ make: 'Hyundai', year: 2011 })
  })

  it('returns null rather than throwing when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await lookupVin(GENESIS)).toBeNull()
  })

  it('returns null on a non-ok response', async () => {
    stubFetch({}, false)
    expect(await lookupVin(GENESIS)).toBeNull()
  })
})
