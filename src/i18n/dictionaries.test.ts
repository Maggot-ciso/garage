import { describe, expect, it } from 'vitest'
import { en, type TranslationKey } from './en'
import { sk } from './sk'
import { DASHBOARD_LIGHTS } from '../data/dashboardLights'

const keys = Object.keys(en) as TranslationKey[]

describe('dictionaries', () => {
  // TypeScript already fails the build on a missing key; this catches the
  // subtler one — a key present but left as the English string.
  it('translates every key into Slovak', () => {
    const untranslated = keys.filter((k) => sk[k] === en[k] && !isProperNoun(en[k]))
    expect(untranslated).toEqual([])
  })

  it('keeps every placeholder that the English string uses', () => {
    for (const key of keys) {
      const wanted = [...en[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      const got = [...sk[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      expect({ key, got }).toEqual({ key, got: wanted })
    }
  })

  it('has no empty strings', () => {
    for (const key of keys) {
      expect(en[key].trim().length).toBeGreaterThan(0)
      expect(sk[key].trim().length).toBeGreaterThan(0)
    }
  })
})

// Every warning light needs its prose in both languages: this is the safety
// text a rider reads at the roadside, so an English fallback is a real gap.
describe('dashboard lights are fully translated', () => {
  it('has a name, meaning and what-to-do for every light', () => {
    for (const light of DASHBOARD_LIGHTS) {
      for (const part of ['name', 'meaning', 'whatToDo'] as const) {
        const key = `light.${light.id}.${part}` as TranslationKey
        expect(en[key], `missing en ${key}`).toBeTruthy()
        expect(sk[key], `missing sk ${key}`).toBeTruthy()
      }
    }
  })
})

// Brand and unit names are the same word in both languages; not a miss.
function isProperNoun(value: string): boolean {
  return /^(Model|ABS|Airbag \/ SRS|FI \/ vstrekovanie)$/.test(value)
}
