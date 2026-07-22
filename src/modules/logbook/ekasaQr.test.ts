import { describe, expect, it } from 'vitest'
import { qrToRequest, requestBody } from './ekasaQr'

describe('qrToRequest', () => {
  it('reads an online receipt (single token) as receiptId', () => {
    const req = qrToRequest('O-9AF2B89F9E204490B2B89F9E20E490B5')
    expect(req).toEqual({ kind: 'online', receiptId: 'O-9AF2B89F9E204490B2B89F9E20E490B5' })
    expect(requestBody(req!)).toEqual({ receiptId: 'O-9AF2B89F9E204490B2B89F9E20E490B5' })
  })

  it('trims surrounding whitespace', () => {
    expect(qrToRequest('  O-ABC123DEF456  ')).toMatchObject({
      kind: 'online',
      receiptId: 'O-ABC123DEF456',
    })
  })

  it('reads an offline receipt (5 parts) and decodes the compact date', () => {
    // okp : cashRegisterCode : YYMMDDhhmmss : receiptNumber : totalAmount
    const req = qrToRequest('ABCD-1234:88821208679580002:260710162918:1585:58.12')
    expect(req).toEqual({
      kind: 'offline',
      okp: 'ABCD-1234',
      cashRegisterCode: '88821208679580002',
      receiptNumber: '1585',
      totalAmount: '58.12',
      issueDateFormatted: '10.07.2026 16:29:18',
    })
    expect(requestBody(req!)).toEqual({
      okp: 'ABCD-1234',
      cashRegisterCode: '88821208679580002',
      receiptNumber: '1585',
      totalAmount: '58.12',
      issueDateFormatted: '10.07.2026 16:29:18',
    })
  })

  it('rejects an offline string with a malformed date', () => {
    expect(qrToRequest('okp:reg:NOTADATE:1585:58.12')).toBeNull()
  })

  it('rejects non-eKasa content', () => {
    expect(qrToRequest('')).toBeNull()
    expect(qrToRequest('   ')).toBeNull()
    expect(qrToRequest('https://example.com/some/page')).toBeNull() // 1 part but not id-shaped
    expect(qrToRequest('hi')).toBeNull() // too short
    expect(qrToRequest('a:b:c')).toBeNull() // 3 parts — unknown shape
  })
})
