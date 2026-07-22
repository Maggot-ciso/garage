import { describe, expect, it } from 'vitest'
import { base64ToBytes, bytesToBase64, toBlob } from './blobCodec'

const bytesOf = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)]

describe('blobCodec', () => {
  it('round-trips binary data', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255, 42])
    expect(bytesOf(base64ToBytes(bytesToBase64(original.buffer)))).toEqual([...original])
  })

  it('round-trips a payload big enough to need chunking', () => {
    // Larger than the 0x8000 chunk: a naive fromCharCode(...all) would throw
    const big = new Uint8Array(200_000).map((_, i) => i % 256)
    const restored = bytesOf(base64ToBytes(bytesToBase64(big.buffer)))
    expect(restored).toHaveLength(200_000)
    expect(restored[0]).toBe(0)
    expect(restored[199_999]).toBe(199_999 % 256)
  })

  it('handles empty input', () => {
    expect(bytesToBase64(new ArrayBuffer(0))).toBe('')
    expect(bytesOf(base64ToBytes(''))).toEqual([])
  })

  it('builds a blob with the right type for display', () => {
    const blob = toBlob(new Uint8Array([1, 2]).buffer, 'application/pdf')
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBe(2)
  })
})
