import { describe, expect, it } from 'vitest'
import { BLINK_SCHEMES, blinkCode, schemeForMake, usesBlinkCodes } from './blinkCodes'
import { en } from '../i18n/en'
import { sk } from '../i18n/sk'

const honda = schemeForMake('Honda')!

describe('schemeForMake', () => {
  it('matches a make case-insensitively', () => {
    expect(schemeForMake('honda')?.make).toBe('honda')
    expect(schemeForMake('HONDA')?.make).toBe('honda')
    expect(schemeForMake('  Honda ')?.make).toBe('honda')
  })

  it('matches a make that leads a longer name', () => {
    expect(schemeForMake('Piaggio Liberty')?.make).toBe('piaggio')
  })

  // Saying nothing is the correct answer for a make nobody checked.
  it('returns nothing for an unchecked make', () => {
    expect(schemeForMake('Kymco')).toBeNull()
    expect(schemeForMake('SYM')).toBeNull()
    expect(schemeForMake(undefined)).toBeNull()
    expect(schemeForMake('')).toBeNull()
  })
})

describe('blinkCode', () => {
  // Honda's own arithmetic: long = 10, short = 1. Two long and one short = 21.
  it('counts long flashes as tens and short as units', () => {
    expect(blinkCode(2, 1, honda)).toBe(21)
    expect(blinkCode(0, 7, honda)).toBe(7)
    expect(blinkCode(1, 0, honda)).toBe(10)
    expect(blinkCode(3, 3, honda)).toBe(33)
  })

  it('has no code when nothing flashed', () => {
    expect(blinkCode(0, 0, honda)).toBeNull()
  })

  it('refuses nonsense rather than returning a number', () => {
    expect(blinkCode(-1, 2, honda)).toBeNull()
    expect(blinkCode(1.5, 0, honda)).toBeNull()
  })

  // Yamaha shows the number on the dash; there is nothing to count.
  it('gives no count for a make that does not flash codes', () => {
    expect(blinkCode(2, 1, schemeForMake('Yamaha')!)).toBeNull()
  })
})

describe('the table claims only what was verified', () => {
  // The prose lives in the dictionaries now, so these check the text a rider
  // actually reads — in BOTH languages, not just the English source.
  const dicts = { en, sk }

  // The whole point: how to READ the lamp is shared across a make, what the
  // number MEANS is per-model. Shipping a meaning would be the confident
  // wrongness this app refuses elsewhere.
  it('carries no code-to-fault mapping in either language', () => {
    for (const [lang, dict] of Object.entries(dicts)) {
      const blob = BLINK_SCHEMES.map((s) => `${dict[s.howToRead]} ${dict[s.whereItsDefined]}`)
        .join(' ')
        .toLowerCase()
      expect({ lang, hit: /sensor|injector|snímač|vstrekovač|škrtiac/.test(blob) }).toEqual({
        lang,
        hit: false,
      })
    }
  })

  it('always says where the real meaning is defined, in both languages', () => {
    for (const scheme of BLINK_SCHEMES) {
      expect(en[scheme.whereItsDefined]).toMatch(/manual/i)
      expect(sk[scheme.whereItsDefined]).toMatch(/manuál/i)
      expect(en[scheme.howToRead].length).toBeGreaterThan(40)
      expect(sk[scheme.howToRead].length).toBeGreaterThan(40)
    }
  })

  it('only offers the reader to motorcycles and scooters', () => {
    expect(usesBlinkCodes('motorcycle')).toBe(true)
    expect(usesBlinkCodes('car')).toBe(false)
    expect(usesBlinkCodes(undefined)).toBe(false)
  })
})
