import { describe, expect, it } from 'vitest'
import { en } from '../../i18n/en'
import { describeLookup, lookupObd, normaliseCode } from './obdLookup'

describe('normaliseCode', () => {
  it('tidies what someone types off a cheap reader', () => {
    expect(normaliseCode(' p0-420 ')).toBe('P0420')
  })
})

describe('lookupObd', () => {
  it('gives the exact meaning of a known generic code', () => {
    const result = lookupObd('P0420')!
    expect(result.description).toBe('Catalyst system efficiency below threshold (bank 1)')
    expect(result.generic).toBe(true)
    expect(result.system).toBe('powertrain')
  })

  it('reads misfire codes, the most common thing a reader shows', () => {
    expect(lookupObd('P0300')!.description).toBe('Random/multiple cylinder misfire detected')
    expect(lookupObd('P0304')!.description).toBe('Cylinder 4 misfire detected')
  })

  it('still decodes the structure of a code missing from the table', () => {
    const result = lookupObd('P0399')!
    expect(result.description).toBeUndefined()
    expect(result.generic).toBe(true)
    // A key now — the structural decode is what matters, the wording is the
    // dictionary's job.
    expect(result.subsystem).toBe('obd.sub.3')
    expect(en['obd.sub.3']).toBe('Ignition system or misfire')
  })

  it('flags manufacturer-specific codes instead of guessing', () => {
    const result = lookupObd('P1234')!
    expect(result.generic).toBe(false)
    expect(result.description).toBeUndefined()
    expect(describeLookup(result)).toEqual({ key: 'obd.manufacturerSpecific' })
  })

  it('knows the non-powertrain systems', () => {
    expect(lookupObd('C0035')!.system).toBe('chassis')
    expect(lookupObd('B0001')!.system).toBe('body')
    expect(lookupObd('U0100')!.system).toBe('network')
  })

  it('does not offer a powertrain subsystem for a chassis code', () => {
    expect(lookupObd('C0035')!.subsystem).toBeUndefined()
  })

  it('rejects anything that is not a code', () => {
    expect(lookupObd('hello')).toBeNull()
    expect(lookupObd('P042')).toBeNull()
    expect(lookupObd('X0420')).toBeNull()
    expect(lookupObd('P9420')).toBeNull()
  })
})

describe('describeLookup', () => {
  it('prefers the exact description', () => {
    // The code's own description stays verbatim — catalogue wording, not translated.
    expect(describeLookup(lookupObd('P0171')!)).toEqual({ verbatim: 'System too lean (bank 1)' })
  })

  it('falls back to the subsystem for an unknown generic code', () => {
    expect(describeLookup(lookupObd('P0599')!)).toMatchObject({ key: expect.any(String) })
  })
})
