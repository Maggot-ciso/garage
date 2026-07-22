import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId } from './id'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.restoreAllMocks()
})

describe('newId', () => {
  it('produces a v4 UUID', () => {
    expect(newId()).toMatch(UUID_RE)
  })

  it('produces a valid v4 UUID without crypto.randomUUID (insecure context)', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: crypto.getRandomValues.bind(crypto),
      randomUUID: undefined,
    })
    const id = newId()
    expect(id).toMatch(UUID_RE)
    expect(newId()).not.toBe(id)
  })
})
