// Slovak eKasa receipts carry a QR code that maps to the Financial
// Administration receipt API — the whole receipt, exact numbers, no AI, no key,
// no cost. This is the "no AI where deterministic code will do" principle
// applied to receipts.
//
// The decoded QR is a colon-separated string (format confirmed against the live
// API and the PVi1/skener-blockov reference):
//   - 1 part  → online receipt; the token IS the receiptId (e.g. "O-9AF2…").
//   - 5 parts → offline receipt: okp:cashRegisterCode:dateCompact:receiptNumber:totalAmount
//               where dateCompact is YYMMDDhhmmss.
// Anything else is not an eKasa QR.

// The request body the /opd/receipt/find endpoint expects. Online receipts are
// looked up by id; offline ones (issued when the register had no connection and
// so never got a server-assigned id) by their signed fields.
export type EkasaRequest =
  | { kind: 'online'; receiptId: string }
  | {
      kind: 'offline'
      okp: string
      cashRegisterCode: string
      receiptNumber: string
      totalAmount: string
      issueDateFormatted: string
    }

// YYMMDDhhmmss → "DD.MM.20YY hh:mm:ss" (the format the API's offline lookup
// wants), matching the reference implementation exactly.
function formatCompactDate(d: string): string | null {
  if (!/^\d{12}$/.test(d)) return null
  const yy = d.slice(0, 2)
  const mm = d.slice(2, 4)
  const dd = d.slice(4, 6)
  const hh = d.slice(6, 8)
  const mi = d.slice(8, 10)
  const ss = d.slice(10, 12)
  return `${dd}.${mm}.20${yy} ${hh}:${mi}:${ss}`
}

export function qrToRequest(decoded: string): EkasaRequest | null {
  const raw = decoded.trim()
  if (!raw) return null
  const parts = raw.split(':')

  if (parts.length === 1) {
    // Online: a single opaque token. Guard against arbitrary text sneaking in —
    // an eKasa id is a short run of id-safe characters, never whitespace.
    const id = parts[0]
    if (!/^[A-Za-z0-9.\-_]{6,80}$/.test(id)) return null
    return { kind: 'online', receiptId: id }
  }

  if (parts.length === 5) {
    const [okp, cashRegisterCode, dateCompact, receiptNumber, totalAmount] = parts
    const issueDateFormatted = formatCompactDate(dateCompact)
    if (!issueDateFormatted || !okp || !cashRegisterCode) return null
    return {
      kind: 'offline',
      okp,
      cashRegisterCode,
      receiptNumber,
      totalAmount,
      issueDateFormatted,
    }
  }

  return null
}

// The wire payload actually POSTed — online sends only receiptId; offline sends
// its signed fields (kind is internal and dropped).
export function requestBody(req: EkasaRequest): Record<string, string> {
  if (req.kind === 'online') return { receiptId: req.receiptId }
  const { kind: _kind, ...rest } = req
  return rest
}
