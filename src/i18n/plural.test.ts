import { describe, expect, it } from 'vitest'
import { pluralise } from './plural'

const days = { one: '{count} deň', few: '{count} dni', many: '{count} dňa', other: '{count} dní' }

describe('pluralise — Slovak', () => {
  it('uses the three Slovak forms correctly', () => {
    expect(pluralise(1, 'sk', days)).toBe('1 deň')
    expect(pluralise(2, 'sk', days)).toBe('2 dni')
    expect(pluralise(3, 'sk', days)).toBe('3 dni')
    expect(pluralise(4, 'sk', days)).toBe('4 dni')
    expect(pluralise(5, 'sk', days)).toBe('5 dní')
    expect(pluralise(0, 'sk', days)).toBe('0 dní')
    expect(pluralise(11, 'sk', days)).toBe('11 dní')
  })
})

describe('pluralise — English', () => {
  const d = { one: '{count} day', other: '{count} days' }
  it('uses the two English forms', () => {
    expect(pluralise(1, 'en', d)).toBe('1 day')
    expect(pluralise(0, 'en', d)).toBe('0 days')
    expect(pluralise(5, 'en', d)).toBe('5 days')
  })
  it('falls back to other when a form is absent', () => {
    expect(pluralise(3, 'en', d)).toBe('3 days')
  })
})
