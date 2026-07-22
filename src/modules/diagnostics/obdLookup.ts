import { OBD_CODES } from '../../data/obdCodes'

// An OBD-II code is structured, not arbitrary: the letter is the system, the
// second character says whether it is a standard code or manufacturer-specific,
// and for powertrain codes the third names the subsystem. That means even a
// code missing from the table still decodes usefully — the same shape as the
// VIN WMI fallback.

const CODE_SHAPE = /^[PBCU][0-3][0-9A-F]{3}$/

export type ObdSystem = 'powertrain' | 'body' | 'chassis' | 'network'

const SYSTEMS: Record<string, { system: ObdSystem; label: string }> = {
  P: { system: 'powertrain', label: 'Powertrain — engine, transmission, emissions' },
  B: { system: 'body', label: 'Body — airbags, seating, comfort systems' },
  C: { system: 'chassis', label: 'Chassis — braking, steering, suspension' },
  U: { system: 'network', label: 'Network — modules not talking to each other' },
}

// Third character of a powertrain code
const POWERTRAIN_SUBSYSTEMS: Record<string, string> = {
  '0': 'Fuel and air metering, auxiliary emission controls',
  '1': 'Fuel and air metering',
  '2': 'Fuel and air metering — injector circuit',
  '3': 'Ignition system or misfire',
  '4': 'Auxiliary emission controls',
  '5': 'Vehicle speed control and idle control',
  '6': 'Computer output circuit',
  '7': 'Transmission',
  '8': 'Transmission',
}

export interface ObdLookup {
  code: string
  system: ObdSystem
  systemLabel: string
  /** Standard SAE code (identical on every car) rather than manufacturer-specific */
  generic: boolean
  subsystem?: string
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
export function describeLookup(result: ObdLookup): string {
  if (result.description) return result.description
  if (!result.generic) {
    return `Manufacturer-specific code — its meaning is defined by the carmaker, not the OBD-II standard.`
  }
  return result.subsystem
    ? `Standard code in: ${result.subsystem.toLowerCase()}.`
    : `Standard ${result.system} code.`
}
