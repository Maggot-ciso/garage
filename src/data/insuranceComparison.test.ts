import { describe, expect, it } from 'vitest'
import { comparisonSitesFor } from './insuranceComparison'

describe('PZP comparison sites', () => {
  it('lists Slovak comparators for a Slovak driver', () => {
    const sites = comparisonSitesFor('SK')
    expect(sites.length).toBeGreaterThan(0)
    expect(sites.map((s) => s.name)).toContain('Netfinancie.sk')
  })

  it('accepts a lowercase country code', () => {
    expect(comparisonSitesFor('sk')).toEqual(comparisonSitesFor('SK'))
  })

  // Inventing a comparator for a market nobody checked is exactly the failure
  // this table exists to prevent, so an unknown country gets nothing.
  it('returns nothing for a country with no checked comparators', () => {
    expect(comparisonSitesFor('DE')).toEqual([])
    expect(comparisonSitesFor(undefined)).toEqual([])
    expect(comparisonSitesFor(null)).toEqual([])
  })

  it('gives every site an https url and a distinguishing note', () => {
    for (const site of comparisonSitesFor('SK')) {
      expect(site.url).toMatch(/^https:\/\//)
      expect(site.note.length).toBeGreaterThan(0)
    }
  })

  // No price may be baked in anywhere: a premium depends on the driver, and a
  // stale number presented as current is worse than no number.
  it('carries no prices', () => {
    const blob = JSON.stringify(comparisonSitesFor('SK'))
    expect(blob).not.toMatch(/\d+\s*(€|EUR|eur)/)
  })
})
