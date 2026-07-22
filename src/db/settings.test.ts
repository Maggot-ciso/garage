import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { getSetting, removeSetting, setSetting } from './settings'

beforeEach(async () => {
  await db.settings.clear()
})

describe('settings repository', () => {
  it('returns undefined for a missing key', async () => {
    expect(await getSetting('nope')).toBeUndefined()
  })

  it('stores and retrieves a value', async () => {
    await setSetting('aiModel', 'claude-opus-4-8')
    expect(await getSetting('aiModel')).toBe('claude-opus-4-8')
  })

  it('overwrites an existing value', async () => {
    await setSetting('aiModel', 'a')
    await setSetting('aiModel', 'b')
    expect(await getSetting('aiModel')).toBe('b')
  })

  it('removes a value', async () => {
    await setSetting('aiApiKey', 'sk-test')
    await removeSetting('aiApiKey')
    expect(await getSetting('aiApiKey')).toBeUndefined()
  })
})
