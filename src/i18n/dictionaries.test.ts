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

  // A translation may legitimately drop one — Slovak says "raz za mesiac", not
  // "raz za 1 mesiac" — but inventing one renders as literal braces on screen.
  it('never introduces a placeholder the English string does not have', () => {
    for (const key of keys) {
      const allowed = new Set([...en[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]))
      const used = [...sk[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1])
      expect({ key, unknown: used.filter((name) => !allowed.has(name)) }).toEqual({
        key,
        unknown: [],
      })
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

// Same word in both languages: brand names, standard abbreviations, and
// strings that are only a number and a unit symbol.
function isProperNoun(value: string): boolean {
  if (/^\{\w+\}\s*(km|mm|l|€|%)$/.test(value)) return true
  // STK/EK is the Slovak inspection's own abbreviation, used as-is in English too.
  return /^(Model|ABS|ESP|STK\/EK|Airbag \/ SRS|FI \/ vstrekovanie)$/.test(value)
}
