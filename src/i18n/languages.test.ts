import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectLanguage, isLanguage } from './languages'

function stub(tags: string[]) {
  vi.stubGlobal('navigator', { languages: tags, language: tags[0] })
}

describe('detectLanguage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('picks Slovak for a Slovak device', () => {
    stub(['sk-SK'])
    expect(detectLanguage()).toBe('sk')
  })

  it('picks Slovak when the region is Slovakia even in another UI language', () => {
    stub(['cs-SK'])
    expect(detectLanguage()).toBe('sk')
  })

  it('falls back to English for anything unsupported', () => {
    stub(['de-DE'])
    expect(detectLanguage()).toBe('en')
    stub([])
    expect(detectLanguage()).toBe('en')
  })

  it('honours the first supported language in the list', () => {
    stub(['en-US', 'sk-SK'])
    expect(detectLanguage()).toBe('en')
  })
})

describe('isLanguage', () => {
  it('accepts only supported codes', () => {
    expect(isLanguage('sk')).toBe(true)
    expect(isLanguage('en')).toBe(true)
    expect(isLanguage('de')).toBe(false)
    expect(isLanguage(null)).toBe(false)
  })
})
