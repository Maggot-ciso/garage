import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { isAiConfigured, askAi, resolveModel, MissingApiKeyError } from './aiClient'
import { setSetting, SETTING_KEYS } from '../db/settings'

beforeEach(async () => {
  await db.settings.clear()
})

describe('aiClient', () => {
  it('reports unconfigured when no key is stored', async () => {
    expect(await isAiConfigured()).toBe(false)
  })

  it('reports configured when a key is stored', async () => {
    await setSetting(SETTING_KEYS.aiApiKey, 'sk-ant-test')
    expect(await isAiConfigured()).toBe(true)
  })

  it('throws MissingApiKeyError without a key instead of calling the API', async () => {
    await expect(askAi({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toBeInstanceOf(
      MissingApiKeyError,
    )
  })
})

describe('resolveModel', () => {
  it('routes per task on auto or when unset', () => {
    expect(resolveModel(undefined, 'chat')).toBe('claude-sonnet-5')
    expect(resolveModel('auto', 'chat')).toBe('claude-sonnet-5')
    expect(resolveModel('auto', 'extract')).toBe('claude-haiku-4-5')
  })

  it('a pinned model wins for every task', () => {
    expect(resolveModel('claude-opus-4-8', 'chat')).toBe('claude-opus-4-8')
    expect(resolveModel('claude-opus-4-8', 'extract')).toBe('claude-opus-4-8')
  })
})
