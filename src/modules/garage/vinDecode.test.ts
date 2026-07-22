import { describe, expect, it } from 'vitest'
import {
  decodeModelYear,
  decodeVinLocally,
  decodeWmi,
  looksUsMarket,
  normaliseVin,
  validateVin,
  vinCheckDigit,
} from './vinDecode'

// A synthetic Genesis Coupe VIN (real WMI + 2011 year code, fictional
// serial) and the same VIN with an invalid check digit.
const GENESIS = 'KMHHU61HXBU100001'
const GENESIS_TYPO = 'KMHHU61HBBU100001'
const OCTAVIA = 'TMBJG7NE0J0123456'

describe('normaliseVin', () => {
  it('uppercases and strips separators', () => {
    expect(normaliseVin(' kmhhu61hxbu-100001 ')).toBe(GENESIS)
  })
})

describe('vinCheckDigit', () => {
  it('computes the ninth-position digit', () => {
    // Remainder 10 encodes as 'X' — the one non-numeric check digit
    expect(vinCheckDigit(GENESIS)).toBe('X')
  })

  it('is null for anything that is not a 17-character VIN', () => {
    expect(vinCheckDigit('TOO-SHORT')).toBeNull()
  })
})

describe('validateVin', () => {
  it('accepts a well-formed VIN', () => {
    expect(validateVin(GENESIS)).toBeNull()
  })

  it('catches the wrong length', () => {
    expect(validateVin('KMHHU61H9BU06013')).toBe('length')
  })

  it('rejects I, O and Q, which never appear in a VIN', () => {
    expect(validateVin('KMHHU61H9BU06O137')).toBe('characters')
  })

  it('flags a bad check digit without refusing the VIN', () => {
    expect(validateVin(GENESIS_TYPO)).toBe('check-digit')
  })
})

describe('decodeWmi', () => {
  it('knows Slovak and Czech plants', () => {
    expect(decodeWmi(OCTAVIA)).toEqual({ make: 'Škoda', country: 'Czechia' })
    expect(decodeWmi('U5YFF24229L000001')).toEqual({ make: 'Kia', country: 'Slovakia' })
  })

  it('knows the owner car', () => {
    expect(decodeWmi(GENESIS)).toEqual({ make: 'Hyundai', country: 'South Korea' })
  })

  it('falls back to a region for an unknown manufacturer', () => {
    expect(decodeWmi('ZZZJG7NE0J0123456')).toEqual({ country: 'Europe' })
    expect(decodeWmi('1ZZJG7NE0J0123456')).toEqual({ country: 'North America' })
  })
})

describe('decodeModelYear', () => {
  it('prefers the recent cycle, which is what a logbook actually holds', () => {
    expect(decodeModelYear(OCTAVIA)).toBe(2018) // J
    // Verified against NHTSA for this exact VIN: 2011, not 1981. The
    // textbook position-7 tie-breaker gets this wrong.
    expect(decodeModelYear(GENESIS)).toBe(2011) // B
  })

  it('falls back to the older cycle rather than returning a future year', () => {
    // 'Y' would be 2030 on the recent cycle — not a car anyone is driving
    expect(decodeModelYear('TMBJG7NE0Y0123456')).toBe(2000)
  })

  it('is undefined for an impossible year code', () => {
    expect(decodeModelYear('TMBJG7NE0Q0123456')).toBeUndefined()
  })
})

describe('decodeVinLocally', () => {
  it('decodes a European VIN with no network at all', () => {
    expect(decodeVinLocally(OCTAVIA)).toEqual({
      vin: OCTAVIA,
      problem: null,
      make: 'Škoda',
      country: 'Czechia',
      year: 2018,
    })
  })

  it('suggests the corrected VIN when only the check digit is wrong', () => {
    const result = decodeVinLocally(GENESIS_TYPO)
    expect(result.problem).toBe('check-digit')
    expect(result.suggestedVin).toBe(GENESIS)
  })

  it('stops early on a malformed VIN', () => {
    expect(decodeVinLocally('nope')).toEqual({ vin: 'NOPE', problem: 'length' })
  })
})

describe('looksUsMarket', () => {
  it('is true for NHTSA-covered manufacturers', () => {
    expect(looksUsMarket(GENESIS)).toBe(true)
    expect(looksUsMarket('1FAFP34N85W123456')).toBe(true)
  })

  it('is false for a European car NHTSA has never heard of', () => {
    expect(looksUsMarket(OCTAVIA)).toBe(false)
  })
})

// Real vehicles the owner asked to support.
const YAMAHA = 'JYARN258000001094' // motorcycle — fails the check digit legitimately
const HONDA_SCOOTER = 'RLHJK41B6SY121240' // scooter — check digit happens to be valid

describe('motorcycles and scooters', () => {
  it('decodes a Yamaha motorcycle without calling it a typo', () => {
    const result = decodeVinLocally(YAMAHA)
    expect(result.make).toBe('Yamaha')
    expect(result.country).toBe('Japan')
    // The check digit is only required in North America; this VIN is Japanese.
    expect(result.problem).toBeNull()
    // So no "corrected VIN" is offered — suggesting one would be wrong.
    expect(result.suggestedVin).toBeUndefined()
  })

  it('declines to invent a model year when position 10 is not a year code', () => {
    // '0' is absent from the year alphabet — better to say nothing than guess.
    expect(decodeVinLocally(YAMAHA).year).toBeUndefined()
  })

  it('decodes a Honda scooter', () => {
    const result = decodeVinLocally(HONDA_SCOOTER)
    expect(result.make).toBe('Honda')
    expect(result.country).toBe('Vietnam')
    expect(result.problem).toBeNull()
    expect(result.year).toBe(2025)
  })

  it('still enforces the check digit on North American VINs', () => {
    // The Genesis is US-market, so a wrong check digit there IS a typo.
    expect(decodeVinLocally(GENESIS).problem).toBeNull()
    const typo = decodeVinLocally(GENESIS_TYPO)
    expect(typo.problem).toBe('check-digit')
    expect(typo.suggestedVin).toBe(GENESIS)
  })
})
