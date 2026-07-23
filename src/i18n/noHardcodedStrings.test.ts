import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Untranslated text has now slipped through twice, both times found by the
// owner rather than by us. This turns "did I catch them all?" into something
// the build answers: any user-facing literal in a component has to come from
// t(), or be listed below with a reason.
//
// It reads the source rather than the render tree on purpose — a screen only
// shows the strings for the state it happens to be in, which is exactly how
// the earlier ones were missed.

const SRC = dirname(dirname(fileURLToPath(import.meta.url)))

// Text that is the same in any language, or is an example rather than prose.
const ALLOWED = new Set([
  'Michelin', // brand, shown as a placeholder example
  'Pilot Sport 4',
  'Octavia',
  'Škoda',
  'P0420', // OBD code format example
  '225/40 R19', // tyre size format example
  '130000',
  '152000',
  '165000',
  '10000',
  '45.3',
  '42.10',
  '68.50',
  '69.55',
  '5.5',
  '0.00',
  '12',
  'sk-ant-...',
  'claude-…',
  'GarageBook',
])

function sourceFiles(dir: string, ext: '.tsx' | '.ts'): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path, ext)
    const matches = ext === '.tsx' ? name.endsWith('.tsx') : name.endsWith('.ts')
    return matches && !name.includes('.test.') ? [path] : []
  })
}

// Tailwind class lists are strings in the same places prose is, and are not
// text anyone reads. Utility prefixes and the dark: variant identify them.
function looksLikeClassNames(value: string): boolean {
  if (/(^|\s)(dark|hover|focus|active|disabled|sm|md|lg):/.test(value)) return true
  const tokens = value.split(/\s+/)
  const utility = tokens.filter((tok) =>
    /^-?(bg|text|border|flex|self|grid|items|justify|gap|rounded|font|shadow|ring|p|m|w|h|min|max|top|left|right|bottom|z|opacity|overflow|truncate|block|inline|absolute|relative|fixed|sticky)(-|$)/.test(tok),
  )
  return tokens.length > 1 && utility.length >= tokens.length / 2
}

// A translation key looks like 'reminders.new'; prose does not.
function looksLikeKey(value: string): boolean {
  return /^[a-z][\w-]*(\.[\w-]+)+$/.test(value)
}

// Text that reaches the screen from a data table rather than from JSX. The
// reminder presets sat here in English for exactly this reason: the scanner
// only read components, and this is a .ts file.
function scanData(path: string): Finding[] {
  const source = readFileSync(path, 'utf8')
  const file = path.slice(SRC.length + 1)
  const found: Finding[] = []
  for (const m of source.matchAll(/\b(?:label|title|hint|cta)\s*:\s*'([^']+)'/g)) {
    const value = m[1]!
    if (looksLikeKey(value) || ALLOWED.has(value)) continue
    if (!/[A-Za-zÀ-ž]{3}/.test(value)) continue
    found.push({ file, text: value })
  }
  return found
}

interface Finding {
  file: string
  text: string
}

function scan(path: string): Finding[] {
  const source = readFileSync(path, 'utf8')
  const file = path.slice(SRC.length + 1)
  const found: Finding[] = []

  const add = (text: string, kind?: 'jsx') => {
    const value = text.trim()
    if (!value || ALLOWED.has(value)) return
    // Needs at least one run of letters to be prose rather than punctuation,
    // symbols or a number.
    if (!/[A-Za-zÀ-ž]{4}/.test(value)) return
    if (looksLikeClassNames(value)) return
    // Prose is a phrase, or at least starts with a capital. A bare lowercase
    // token is a state value, a CSS class or a MIME type — 'denied',
    // 'notice-error', 'application/pdf' — none of which anyone reads.
    if (!/\s/.test(value) && !/^[A-ZÀ-Ž•]/.test(value)) return
    // Code that happens to sit where prose would: calls, assignments, member
    // access. Prose in this app never contains these.
    if (kind === 'jsx' && /[();=]|\.\w+\(|\w\.\w/.test(value)) return
    found.push({ file, text: value })
  }

  // User-visible props
  for (const m of source.matchAll(/\b(?:aria-label|placeholder|title|alt)="([^"]+)"/g)) {
    add(m[1]!)
  }
  // Dialogs
  for (const m of source.matchAll(/window\.(?:confirm|alert)\(\s*'([^']+)'/g)) add(m[1]!)
  // The {cond ? 'A' : 'B'} idiom — text inside braces, invisible to the JSX
  // text rule, which is exactly how the reminder submit button survived.
  for (const m of source.matchAll(/\?\s*'([^']{4,})'\s*:\s*'([^']{4,})'/g)) {
    add(m[1]!)
    add(m[2]!)
  }

  // JSX text nodes: between > and <, with no braces or tags of their own.
  // The lookbehind keeps `=>` and the `>>` of a nested generic out — those are
  // code, and matching them buried the real findings in noise.
  for (const m of source.matchAll(/(?<![=>])>([^<>{}\n]{4,})</g)) add(m[1]!, 'jsx')
  // JSX text on its own line inside an element
  for (const m of source.matchAll(/^\s{6,}([A-Z][A-Za-zÀ-ž][^<>{}\n]{3,})$/gm)) add(m[1]!, 'jsx')
  // Text trailing a tag to the end of the line, with the closing tag below —
  // "<ArrowLeft … /> Garage". The paired-delimiter rule cannot see it.
  for (const m of source.matchAll(/\/>[ \t]+([A-ZÀ-Ž][^<>{}\n]{3,})[ \t]*$/gm)) add(m[1]!, 'jsx')

  return found
}

describe('components never hardcode user-facing text', () => {
  it('routes every string through the dictionaries', () => {
    const findings = [
      ...sourceFiles(join(SRC, 'modules'), '.tsx').flatMap(scan),
      ...sourceFiles(join(SRC, 'components'), '.tsx').flatMap(scan),
      ...sourceFiles(join(SRC, 'modules'), '.ts').flatMap(scanData),
      ...sourceFiles(join(SRC, 'data'), '.ts').flatMap(scanData),
    ]

    // Reported as file + text so a failure names exactly what to translate.
    expect(findings).toEqual([])
  })
})
