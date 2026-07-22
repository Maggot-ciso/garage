import { requestBody, type EkasaRequest } from './ekasaQr'
import type { EkasaReceipt } from './ekasaMap'

// The public Financial Administration endpoint the official "Over doklad" app
// uses. It returns CORS `*`, so a browser/webview fetch works directly; the only
// gate is a WAF that rejects non-browser User-Agents (which fetch can't set and
// doesn't need — the native UA passes).
const ENDPOINT = 'https://ekasa.financnasprava.sk/mdu/api/v1/opd/receipt/find'
const TIMEOUT_MS = 10_000

// Distinct errors so the UI can tell "no such receipt" (don't retry) from "the
// service was unreachable" (offer manual entry).
export class EkasaNotFoundError extends Error {
  constructor() {
    super('Receipt not found in the eKasa system.')
    this.name = 'EkasaNotFoundError'
  }
}

export class EkasaNetworkError extends Error {
  constructor(message = "Couldn't reach the eKasa service.") {
    super(message)
    this.name = 'EkasaNetworkError'
  }
}

interface EkasaResponse {
  returnValue?: number
  receipt?: EkasaReceipt
}

export async function fetchReceipt(req: EkasaRequest): Promise<EkasaReceipt> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody(req)),
      signal: controller.signal,
    })
  } catch {
    throw new EkasaNetworkError()
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) throw new EkasaNetworkError(`eKasa service returned ${res.status}.`)

  let data: EkasaResponse
  try {
    data = (await res.json()) as EkasaResponse
  } catch {
    throw new EkasaNetworkError('eKasa returned an unreadable response.')
  }

  // returnValue 0 = found. Anything else (or no receipt) means the id/signed
  // fields didn't resolve to a receipt.
  if (data.returnValue !== 0 || !data.receipt) throw new EkasaNotFoundError()
  return data.receipt
}
