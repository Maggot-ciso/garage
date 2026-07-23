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
  'TMBJJ7NE4J0123456', // VIN format example
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
  return scanSource(readFileSync(path, 'utf8'), path.slice(SRC.length + 1))
}

// The opposite failure: a key map rendered straight into JSX, so the screen
// shows `severity.soon` instead of the sentence. English leaking out is caught
// above; this catches the key leaking out, which happened the moment a label
// table was converted and its render site was missed.
export function scanUntranslatedKeys(source: string, file = 'snippet.tsx'): Finding[] {
  const maps = [...source.matchAll(/const (\w+)\s*:\s*Record<[^>]*,\s*TranslationKey>/g)].map(
    (m) => m[1]!,
  )
  const found: Finding[] = []
  for (const name of maps) {
    // Rendered as {MAP[...]} rather than {t(MAP[...])}
    for (const m of source.matchAll(new RegExp(`\\{\\s*${name}\\[`, 'g'))) {
      const before = source.slice(Math.max(0, m.index! - 12), m.index!)
      if (!/t\($/.test(before.trim())) found.push({ file, text: `${name}[…] rendered without t()` })
    }
  }
  return found
}

export function scanSource(source: string, file = 'snippet.tsx'): Finding[] {
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
  // Template literals that build a sentence around values: `${n} € a month`.
  // The prose hides between the holes, so nothing above sees it. className
  // templates are skipped — those are styling, not text.
  for (const m of source.matchAll(/`([^`]*)`/g)) {
    const before = source.slice(Math.max(0, m.index! - 28), m.index!)
    if (/className|class=|Src|url\(|import\(|download\s*=/.test(before)) continue
    // `light.${id}.name` and friends build a key or a path, not a sentence.
    if (!/\s/.test(m[1]!) && m[1]!.includes('.')) continue
    const prose = m[1]!.replace(/\$\{[^}]*\}/g, ' ')
    const words = prose.match(/[A-Za-zÀ-ž]{2,}/g) ?? []
    // Two words normally, but one is enough when it is punctuated like a
    // sentence: `Filled ${list}.` collapses to "Filled" and would slip past.
    const sentenceish = /[.!?:]/.test(prose) && /^[A-ZÀ-Ž]/.test(prose.trim())
    if (words.length >= 2 || (words.length === 1 && sentenceish)) {
      add(prose.replace(/\s+/g, ' ').trim())
    }
  }
  // Text inside braces, invisible to the JSX text rule — how the reminder
  // submit button survived. Each branch is matched on its own: requiring BOTH
  // to be literals meant translating one branch hid the other, which is how
  // the VIN-character note and "Coming up soon" survived the last pass.
  for (const m of source.matchAll(/\?\s*'([^'\n]{4,})'/g)) add(m[1]!)
  for (const m of source.matchAll(/:\s*'([^'\n]{4,})'\s*[,)}\n]/g)) add(m[1]!)

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
      ...sourceFiles(join(SRC, 'modules'), '.tsx').flatMap((p) =>
        scanUntranslatedKeys(readFileSync(p, 'utf8'), p.slice(SRC.length + 1)),
      ),
      ...sourceFiles(join(SRC, 'components'), '.tsx').flatMap((p) =>
        scanUntranslatedKeys(readFileSync(p, 'utf8'), p.slice(SRC.length + 1)),
      ),
    ]

    // Reported as file + text so a failure names exactly what to translate.
    expect(findings).toEqual([])
  })
})

// The scanner's own tests. Without these a rule can silently stop matching and
// the suite still passes, because a clean tree proves nothing about coverage —
// which is exactly how a one-sided ternary hid three strings.
describe('the scanner itself', () => {
  const texts = (src: string) => scanSource(src).map((f) => f.text)

  it('catches a bare JSX string', () => {
    expect(texts('<span className="label">Total cost</span>')).toContain('Total cost')
  })

  it('catches BOTH branches of a ternary, not only a pair of literals', () => {
    // The regression: translating one branch used to hide the other.
    expect(texts("{busy ? t('a.b') : 'Coming up soon'}")).toContain('Coming up soon')
    expect(texts("{busy ? 'Reading receipt…' : t('a.b')}")).toContain('Reading receipt…')
  })

  it('catches a one-word sentence built by a template', () => {
    expect(texts('const note = `Filled ${list}.`')).toContain('Filled .')
  })

  it('catches prose between template holes', () => {
    expect(texts('`${n} € a month, from ${s} of logbook`')).toContain(
      '€ a month, from of logbook',
    )
  })

  it('catches labels and dialogs', () => {
    expect(texts('<input placeholder="Who you paid" />')).toContain('Who you paid')
    expect(texts("window.confirm('Delete this entry?')")).toContain('Delete this entry?')
  })

  it('leaves styling, keys, paths and filenames alone', () => {
    expect(texts('className={`card flex ${open ? "bg-red-50" : "border-slate-300"}`}')).toEqual([])
    expect(texts('t(`light.${id}.whatToDo`)')).toEqual([])
    expect(texts('a.download = `garagebook-backup-${date}.json`')).toEqual([])
    expect(texts("const mode = ok ? 'denied' : 'unavailable'")).toEqual([])
  })

  it('catches a key map rendered without t()', () => {
    const src = `const SEVERITY: Record<Severity, TranslationKey> = { a: 'x.y' }
      return <div>{SEVERITY[light.severity]}</div>`
    expect(scanUntranslatedKeys(src).map((f) => f.text)).toHaveLength(1)
  })

  it('accepts the same map once it goes through t()', () => {
    const src = `const SEVERITY: Record<Severity, TranslationKey> = { a: 'x.y' }
      return <div>{t(SEVERITY[light.severity])}</div>`
    expect(scanUntranslatedKeys(src)).toEqual([])
  })

  it('leaves translated code alone', () => {
    expect(texts("<span>{t('field.totalCost')}</span>")).toEqual([])
    expect(texts("aria-label={t('attach.a11yView', { name: doc.name })}")).toEqual([])
  })
})
