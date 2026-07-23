import type { TranslationKey } from '../../i18n/en'
import { OBD_CODES } from '../../data/obdCodes'

// An OBD-II code is structured, not arbitrary: the letter is the system, the
// second character says whether it is a standard code or manufacturer-specific,
// and for powertrain codes the third names the subsystem. That means even a
// code missing from the table still decodes usefully — the same shape as the
// VIN WMI fallback.

const CODE_SHAPE = /^[PBCU][0-3][0-9A-F]{3}$/

export type ObdSystem = 'powertrain' | 'body' | 'chassis' | 'network'

// Labels and subsystems are the app's own prose about what a code covers, so
// they translate. The code DESCRIPTIONS in data/obdCodes.ts stay English —
// those are the catalogue wording a scan tool and a parts shop both use.
const SYSTEMS: Record<string, { system: ObdSystem; label: TranslationKey }> = {
  P: { system: 'powertrain', label: 'obd.system.powertrain' },
  B: { system: 'body', label: 'obd.system.body' },
  C: { system: 'chassis', label: 'obd.system.chassis' },
  U: { system: 'network', label: 'obd.system.network' },
}

// Third character of a powertrain code
const POWERTRAIN_SUBSYSTEMS: Record<string, TranslationKey> = {
  '0': 'obd.sub.0',
  '1': 'obd.sub.1',
  '2': 'obd.sub.2',
  '3': 'obd.sub.3',
  '4': 'obd.sub.4',
  '5': 'obd.sub.5',
  '6': 'obd.sub.6',
  '7': 'obd.sub.7',
  '8': 'obd.sub.8',
}

export interface ObdLookup {
  code: string
  system: ObdSystem
  systemLabel: TranslationKey
  /** Standard SAE code (identical on every car) rather than manufacturer-specific */
  generic: boolean
  subsystem?: TranslationKey
  /** Exact meaning, when the code is in the table */
  description?: string
}

export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, '')
}

export function lookupObd(raw: string): ObdLookup | null {
  const code = normaliseCode(raw)
  if (!CODE_SHAPE.test(code)) return null

  const letter = code[0]!
  const family = code[1]!
  const entry = SYSTEMS[letter]!
  // 0 and 2 are the SAE-standard ranges; 1 and 3 are the manufacturer's own
  const generic = family === '0' || family === '2'
  const subsystem = letter === 'P' ? POWERTRAIN_SUBSYSTEMS[code[2]!] : undefined
  const description = OBD_CODES[code]

  return {
    code,
    system: entry.system,
    systemLabel: entry.label,
    generic,
    ...(subsystem ? { subsystem } : {}),
    ...(description ? { description } : {}),
  }
}

// What the app can honestly say without asking a model anything.
//
// Returns either the code's own description — kept verbatim in English, the
// wording scan tools and parts catalogues use — or a translatable sentence
// about what kind of code it is. `verbatim` marks which one it is so the UI
// does not try to look the former up in a dictionary.
export type LookupText =
  | { verbatim: string }
  | { key: TranslationKey; vars?: Record<string, string | number> }
  // The subsystem needs translating before it can be put into a sentence, and
  // only the screen has a translator — so it is handed over as a key.
  | { key: 'obd.standardIn'; subsystemKey: TranslationKey }

export function describeLookup(result: ObdLookup): LookupText {
  if (result.description) return { verbatim: result.description }
  if (!result.generic) return { key: 'obd.manufacturerSpecific' }
  return result.subsystem
    ? { key: 'obd.standardIn', subsystemKey: result.subsystem }
    : { key: 'obd.standardCode', vars: { system: result.system } }
}
