import { describe, expect, it } from 'vitest'
import { regionFromLocale, shippingRule } from './region'

describe('regionFromLocale', () => {
  it('reads the region from a language-region tag', () => {
    expect(regionFromLocale('sk-SK')).toEqual({ code: 'SK', name: 'Slovakia', inEu: true })
  })

  it('skips the script subtag', () => {
    expect(regionFromLocale('sr-Latn-RS')?.code).toBe('RS')
  })

  it('accepts an underscore separator and lowercase', () => {
    expect(regionFromLocale('de_at')).toEqual({ code: 'AT', name: 'Austria', inEu: true })
  })

  it('marks non-EU countries correctly', () => {
    expect(regionFromLocale('en-US')).toEqual({
      code: 'US',
      name: 'United States',
      inEu: false,
    })
    // The UK left the EU — a stale membership list would get this wrong
    expect(regionFromLocale('en-GB')?.inEu).toBe(false)
  })

  it('returns null when no region can be determined', () => {
    expect(regionFromLocale('sk')).toBeNull()
    expect(regionFromLocale('')).toBeNull()
    expect(regionFromLocale(undefined)).toBeNull()
    expect(regionFromLocale(null)).toBeNull()
  })
})

describe('shippingRule', () => {
  it('targets the EU as a bloc for a member state', () => {
    const rule = shippingRule({ code: 'SK', name: 'Slovakia', inEu: true })
    expect(rule).toContain('Slovakia (EU)')
    expect(rule).toContain('ship to the EU')
  })

  it('targets the country itself outside the EU', () => {
    const rule = shippingRule({ code: 'US', name: 'United States', inEu: false })
    expect(rule).toContain('ship to United States')
    expect(rule).not.toContain('(EU)')
  })

  it('stays neutral when the region is unknown', () => {
    const rule = shippingRule(null)
    expect(rule).toContain('ship internationally')
    expect(rule).not.toContain('undefined')
  })
})
