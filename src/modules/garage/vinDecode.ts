// VIN structure is an ISO 3779 standard, not a proprietary database — so
// manufacturer, country and model year decode offline, for any car in the
// world, with no API and no key. Only engine/trim detail needs a lookup, and
// only US-market vehicles have a free source for that.

const INVALID_LETTERS = /[IOQ]/
const VIN_CHARS = /^[A-HJ-NPR-Z0-9]{17}$/

export function normaliseVin(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, '')
}

// Each letter maps to a digit; position 9 is the check digit itself (weight 0).
const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
}
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]

export function vinCheckDigit(vin: string): string | null {
  if (!VIN_CHARS.test(vin)) return null
  let total = 0
  for (let i = 0; i < 17; i += 1) {
    const char = vin[i]!
    const value = /\d/.test(char) ? Number(char) : TRANSLIT[char]
    if (value === undefined) return null
    total += value * WEIGHTS[i]!
  }
  const remainder = total % 11
  return remainder === 10 ? 'X' : String(remainder)
}

export type VinProblem = 'length' | 'characters' | 'check-digit'

export function validateVin(vin: string): VinProblem | null {
  if (vin.length !== 17) return 'length'
  if (INVALID_LETTERS.test(vin) || !VIN_CHARS.test(vin)) return 'characters'
  // Advisory only: the check digit is mandatory for North American vehicles
  // and merely conventional elsewhere, so a mismatch is a warning, not a
  // refusal to decode.
  //
  // It is not even conventional on many motorcycles: the check digit and the
  // position-10 year code are North American requirements (49 CFR 565), while
  // ISO 3779 asks only for 17 characters and a WMI. A real Yamaha
  // (JYARN258000001094) fails the check digit and carries '0' where the year
  // code belongs. Flagging that as a typo — and offering a "corrected" VIN —
  // would be confidently wrong, so the check only applies where it is required.
  if (!followsNorthAmericanScheme(vin)) return null
  return vinCheckDigit(vin) === vin[8] ? null : 'check-digit'
}

const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789'

// The check digit and the position-10 model-year code come as a pair: both are
// 49 CFR 565 requirements. A VIN whose position 10 is not even a year code is
// not following that scheme, so its position 9 is not a check digit either and
// must not be judged as one. (The WMI cannot be used for this — a US-market
// Genesis Coupe is built in Korea and still carries a valid check digit.)
function followsNorthAmericanScheme(vin: string): boolean {
  return YEAR_CODES.includes(vin[9] ?? '')
}

interface Wmi {
  make: string
  country: string
}

// Extend this whenever a car turns up that isn't covered — same policy as
// carModels.ts. Slovak/Czech plants first, since that's the local market.
const WMI: Record<string, Wmi> = {
  // Motorcycles and scooters
  JYA: { make: 'Yamaha', country: 'Japan' },
  JH2: { make: 'Honda', country: 'Japan' },
  RLH: { make: 'Honda', country: 'Vietnam' },
  JS1: { make: 'Suzuki', country: 'Japan' },
  JKA: { make: 'Kawasaki', country: 'Japan' },
  ZAP: { make: 'Piaggio', country: 'Italy' },
  VBK: { make: 'KTM', country: 'Austria' },
  WB1: { make: 'BMW Motorrad', country: 'Germany' },

  TMB: { make: 'Škoda', country: 'Czechia' },
  TMP: { make: 'Škoda', country: 'Czechia' },
  TMK: { make: 'Škoda', country: 'Czechia' },
  TMA: { make: 'Hyundai', country: 'Czechia' },
  U5Y: { make: 'Kia', country: 'Slovakia' },
  U6Y: { make: 'Kia', country: 'Slovakia' },
  TRU: { make: 'Audi', country: 'Hungary' },
  TMH: { make: 'Peugeot', country: 'Czechia' },
  KMH: { make: 'Hyundai', country: 'South Korea' },
  KM8: { make: 'Hyundai', country: 'South Korea' },
  KNA: { make: 'Kia', country: 'South Korea' },
  KND: { make: 'Kia', country: 'South Korea' },
  WVW: { make: 'Volkswagen', country: 'Germany' },
  WV1: { make: 'Volkswagen', country: 'Germany' },
  WV2: { make: 'Volkswagen', country: 'Germany' },
  WAU: { make: 'Audi', country: 'Germany' },
  WA1: { make: 'Audi', country: 'Germany' },
  WBA: { make: 'BMW', country: 'Germany' },
  WBS: { make: 'BMW', country: 'Germany' },
  WBY: { make: 'BMW', country: 'Germany' },
  WDB: { make: 'Mercedes-Benz', country: 'Germany' },
  WDD: { make: 'Mercedes-Benz', country: 'Germany' },
  W1K: { make: 'Mercedes-Benz', country: 'Germany' },
  WME: { make: 'smart', country: 'Germany' },
  WF0: { make: 'Ford', country: 'Germany' },
  VF1: { make: 'Renault', country: 'France' },
  VF3: { make: 'Peugeot', country: 'France' },
  VF7: { make: 'Citroën', country: 'France' },
  VSS: { make: 'SEAT', country: 'Spain' },
  ZFA: { make: 'Fiat', country: 'Italy' },
  ZAR: { make: 'Alfa Romeo', country: 'Italy' },
  YV1: { make: 'Volvo', country: 'Sweden' },
  YS3: { make: 'Saab', country: 'Sweden' },
  SAL: { make: 'Land Rover', country: 'United Kingdom' },
  SAJ: { make: 'Jaguar', country: 'United Kingdom' },
  SB1: { make: 'Toyota', country: 'United Kingdom' },
  VNK: { make: 'Toyota', country: 'Turkey' },
  JHM: { make: 'Honda', country: 'Japan' },
  JH4: { make: 'Acura', country: 'Japan' },
  JTD: { make: 'Toyota', country: 'Japan' },
  JN1: { make: 'Nissan', country: 'Japan' },
  JMZ: { make: 'Mazda', country: 'Japan' },
  JF1: { make: 'Subaru', country: 'Japan' },
}

// Fallback when the exact WMI is unknown: the first character alone still
// identifies the assembly region under the standard.
const REGION_BY_FIRST: { match: RegExp; country: string }[] = [
  { match: /[1-5]/, country: 'North America' },
  { match: /[6-7]/, country: 'Oceania' },
  { match: /[89]/, country: 'South America' },
  { match: /[A-H]/, country: 'Africa' },
  { match: /[J-R]/, country: 'Asia' },
  { match: /[S-Z]/, country: 'Europe' },
]

export function decodeWmi(vin: string): { make?: string; country?: string } {
  const known = WMI[vin.slice(0, 3)]
  if (known) return { make: known.make, country: known.country }
  const first = vin[0]
  if (!first) return {}
  const region = REGION_BY_FIRST.find((r) => r.match.test(first))
  return region ? { country: region.country } : {}
}

// Position 10 encodes the model year on a 30-year cycle: A=1980 and A=2010 are
// the same letter. The textbook tie-breaker is position 7 (numeric = older
// cycle), but it is only dependable for North American VINs — it dates a
// 2011 Genesis Coupe to 1981. A logbook tracks cars that are
// driven, so the recent cycle is the far better prior; the older one is used
// only when the recent reading would be in the future.

export function decodeModelYear(vin: string): number | undefined {
  const code = vin[9]
  if (!code) return undefined
  const index = YEAR_CODES.indexOf(code)
  if (index === -1) return undefined
  const older = 1980 + index
  const newer = 2010 + index
  return newer > new Date().getFullYear() + 1 ? older : newer
}

export interface LocalVinDecode {
  vin: string
  problem: VinProblem | null
  make?: string
  country?: string
  year?: number
  suggestedVin?: string
}

// When only the check digit is wrong, the rest of the VIN is almost certainly
// right — offer the corrected form rather than just rejecting it.
function suggestCorrection(vin: string, problem: VinProblem | null): string | undefined {
  if (problem !== 'check-digit') return undefined
  const expected = vinCheckDigit(vin)
  if (expected === null) return undefined
  return vin.slice(0, 8) + expected + vin.slice(9)
}

export function decodeVinLocally(raw: string): LocalVinDecode {
  const vin = normaliseVin(raw)
  const problem = validateVin(vin)
  if (problem === 'length' || problem === 'characters') return { vin, problem }
  return {
    vin,
    problem,
    ...decodeWmi(vin),
    ...(decodeModelYear(vin) !== undefined ? { year: decodeModelYear(vin) } : {}),
    ...(suggestCorrection(vin, problem) ? { suggestedVin: suggestCorrection(vin, problem) } : {}),
  }
}

// Only North American market vehicles are in the free NHTSA database, and its
// WMIs all start with a digit (US/Canada/Mexico) or belong to a manufacturer
// that registered for US import — Hyundai and Kia included.
export function looksUsMarket(vin: string): boolean {
  return /^[1-5]/.test(vin) || ['KMH', 'KM8', 'KNA', 'KND', 'JHM', 'JH4'].includes(vin.slice(0, 3))
}
