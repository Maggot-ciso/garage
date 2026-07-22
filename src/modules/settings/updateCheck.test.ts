import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkForUpdate, compareVersions } from './updateCheck'

describe('compareVersions', () => {
  it('orders by numeric component, not string', () => {
    // The bug a string compare would introduce: '1.10.0' < '1.9.0'
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0)
    expect(compareVersions('1.9.0', '1.10.0')).toBeLessThan(0)
  })

  it('treats equal versions as equal, with or without a v prefix', () => {
    expect(compareVersions('1.4.1', '1.4.1')).toBe(0)
    expect(compareVersions('v1.4.1', '1.4.1')).toBe(0)
    expect(compareVersions('V1.4.1', 'v1.4.1')).toBe(0)
  })

  it('compares each level in turn', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareVersions('1.5.0', '1.4.9')).toBeGreaterThan(0)
    expect(compareVersions('1.4.2', '1.4.1')).toBeGreaterThan(0)
  })

  it('handles missing components and pre-release suffixes', () => {
    expect(compareVersions('1.4', '1.4.0')).toBe(0)
    expect(compareVersions('1.4.1-beta.2', '1.4.1')).toBe(0)
    expect(compareVersions('1.5', '1.4.9')).toBeGreaterThan(0)
  })
})

function stubFetch(payload: unknown, ok = true) {
  const mock = vi.fn().mockResolvedValue({ ok, json: async () => payload })
  vi.stubGlobal('fetch', mock)
  return mock
}

describe('checkForUpdate', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reports a newer release', async () => {
    stubFetch({ tag_name: 'v1.5.0', html_url: 'https://example.test/r/1.5.0', body: 'Notes' })
    expect(await checkForUpdate('1.4.1')).toEqual({
      version: '1.5.0',
      url: 'https://example.test/r/1.5.0',
      notes: 'Notes',
    })
  })

  it('stays quiet when already current or ahead', async () => {
    stubFetch({ tag_name: 'v1.4.1', html_url: 'x' })
    expect(await checkForUpdate('1.4.1')).toBeNull()
    stubFetch({ tag_name: 'v1.4.0', html_url: 'x' })
    expect(await checkForUpdate('1.4.1')).toBeNull()
  })

  it('ignores drafts and pre-releases', async () => {
    stubFetch({ tag_name: 'v9.0.0', html_url: 'x', draft: true })
    expect(await checkForUpdate('1.4.1')).toBeNull()
    stubFetch({ tag_name: 'v9.0.0', html_url: 'x', prerelease: true })
    expect(await checkForUpdate('1.4.1')).toBeNull()
  })

  it('never throws when offline or rate-limited', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await checkForUpdate('1.4.1')).toBeNull()
    stubFetch({}, false) // e.g. 403 rate limit
    expect(await checkForUpdate('1.4.1')).toBeNull()
  })

  it('tolerates a malformed response', async () => {
    stubFetch({ nothing: true })
    expect(await checkForUpdate('1.4.1')).toBeNull()
  })
})
