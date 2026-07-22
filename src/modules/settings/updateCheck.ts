// A sideloaded app has no store to update it, so it checks GitHub itself: the
// public repo's latest release is the source of truth. Read-only, unauthenticated
// and public — no token, no account, no backend.

const RELEASES_API = 'https://api.github.com/repos/Maggot-ciso/garage/releases/latest'
export const RELEASES_PAGE = 'https://github.com/Maggot-ciso/garage/releases/latest'

const TIMEOUT_MS = 8000

export interface UpdateInfo {
  version: string
  url: string
  notes?: string
}

// Numeric-aware comparison so 1.10.0 beats 1.9.0 (a string compare would not).
// Returns >0 when a is newer, <0 when b is newer, 0 when equal.
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .trim()
      .replace(/^v/i, '')
      // Drop any pre-release/build suffix: 1.4.1-beta.2 compares as 1.4.1
      .split(/[-+]/)[0]
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0)

  const x = parse(a)
  const y = parse(b)
  const len = Math.max(x.length, y.length)
  for (let i = 0; i < len; i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

interface GithubRelease {
  tag_name?: string
  html_url?: string
  body?: string
  draft?: boolean
  prerelease?: boolean
}

// Returns the newer release, or null when up to date / unreachable. Never
// throws: an update check must not break Settings for someone offline.
export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
    if (!res.ok) return null
    const release = (await res.json()) as GithubRelease
    if (release.draft || release.prerelease || !release.tag_name) return null
    if (compareVersions(release.tag_name, currentVersion) <= 0) return null
    return {
      version: release.tag_name.replace(/^v/i, ''),
      url: release.html_url ?? RELEASES_PAGE,
      ...(release.body ? { notes: release.body } : {}),
    }
  } catch {
    // Offline, rate-limited, or malformed — stay quiet rather than alarm anyone.
    return null
  } finally {
    clearTimeout(timer)
  }
}
