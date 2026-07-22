import { describe, expect, it } from 'vitest'
import { BLINK_SCHEMES, blinkCode, schemeForMake, usesBlinkCodes } from './blinkCodes'

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
  // The whole point: how to READ the lamp is shared across a make, what the
  // number MEANS is per-model. Shipping a meaning would be the confident
  // wrongness this app refuses elsewhere.
  it('carries no code-to-fault mapping', () => {
    const blob = JSON.stringify(BLINK_SCHEMES).toLowerCase()
    expect(blob).not.toMatch(/sensor|injector|throttle position|o2 |ect |map sensor/)
  })

  it('always says where the real meaning is defined', () => {
    for (const scheme of BLINK_SCHEMES) {
      expect(scheme.whereItsDefined).toMatch(/manual/i)
      expect(scheme.howToRead.length).toBeGreaterThan(40)
    }
  })

  it('only offers the reader to motorcycles and scooters', () => {
    expect(usesBlinkCodes('motorcycle')).toBe(true)
    expect(usesBlinkCodes('car')).toBe(false)
    expect(usesBlinkCodes(undefined)).toBe(false)
  })
})
