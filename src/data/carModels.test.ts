import { describe, expect, it } from 'vitest'
import { CAR_DATABASE, MAKES, filterOptions, modelsForMake } from './carModels'

describe('filterOptions', () => {
  it('is diacritic- and case-insensitive', () => {
    expect(filterOptions(MAKES, 'skoda')).toEqual(['Škoda'])
    expect(filterOptions(MAKES, 'CITRO')).toEqual(['Citroën'])
  })

  it('puts prefix matches before substring matches', () => {
    const result = filterOptions(['Corolla', 'Yaris Cross', 'C-HR'], 'c')
    expect(result).toEqual(['Corolla', 'C-HR', 'Yaris Cross'])
  })

  it('returns everything for an empty query', () => {
    expect(filterOptions(MAKES, ' ')).toEqual(MAKES)
  })
})

describe('modelsForMake', () => {
  it('finds models regardless of casing/diacritics', () => {
    expect(modelsForMake('skoda')).toContain('Octavia')
    expect(modelsForMake('ŠKODA')).toContain('Fabia')
  })

  it('returns empty for unknown makes (free text still allowed)', () => {
    expect(modelsForMake('Koenigsegg')).toEqual([])
  })
})

describe('database sanity', () => {
  it('has no duplicate models within a make', () => {
    for (const [make, models] of Object.entries(CAR_DATABASE)) {
      expect(new Set(models).size, `duplicates in ${make}`).toBe(models.length)
    }
  })

  it('has no empty model names', () => {
    for (const models of Object.values(CAR_DATABASE)) {
      for (const model of models) expect(model.trim()).not.toBe('')
    }
  })
})
