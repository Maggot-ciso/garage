import { looksUsMarket, normaliseVin } from './vinDecode'

// The free NHTSA database covers US-market vehicles only — it rejects a Škoda
// VIN outright ("manufacturer is not registered"). So this is strictly an
// enhancement on top of the offline decode, never a requirement.
const ENDPOINT = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues'
const TIMEOUT_MS = 8000

export interface VinLookup {
  make?: string
  model?: string
  year?: number
  engine?: string
}

function describeEngine(row: Record<string, unknown>): string | undefined {
  const litres = String(row.DisplacementL ?? '').trim()
  const cylinders = String(row.EngineCylinders ?? '').trim()
  if (!litres && !cylinders) return undefined
  const size = litres ? `${Number(litres).toFixed(1)}L` : ''
  const layout = cylinders ? `V${cylinders}` : ''
  return [size, layout].filter(Boolean).join(' ') || undefined
}

export async function lookupVin(raw: string): Promise<VinLookup | null> {
  const vin = normaliseVin(raw)
  if (!looksUsMarket(vin)) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${ENDPOINT}/${vin}?format=json`, { signal: controller.signal })
    if (!response.ok) return null
    const body = (await response.json()) as { Results?: Record<string, unknown>[] }
    const row = body.Results?.[0]
    if (!row) return null

    const year = Number(row.ModelYear)
    const make = String(row.Make ?? '').trim()
    const model = String(row.Model ?? '').trim()
    const engine = describeEngine(row)

    const result: VinLookup = {
      ...(make ? { make: titleCase(make) } : {}),
      ...(model ? { model } : {}),
      ...(Number.isFinite(year) && year > 1900 ? { year } : {}),
      ...(engine ? { engine } : {}),
    }
    return Object.keys(result).length > 0 ? result : null
  } catch {
    // Offline, blocked, or timed out — the offline decode still stands
    return null
  } finally {
    clearTimeout(timer)
  }
}

// NHTSA shouts its makes: "HYUNDAI" reads badly next to "Genesis Coupe"
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
