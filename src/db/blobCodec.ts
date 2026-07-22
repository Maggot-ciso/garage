// Attachment bytes can't go into a JSON backup directly. btoa over a whole
// multi-megabyte buffer via String.fromCharCode(...bytes) overflows the call
// stack, so both directions work in chunks.
const CHUNK = 0x8000

export function bytesToBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < view.length; i += CHUNK) {
    binary += String.fromCharCode(...view.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function base64ToBytes(data: string): ArrayBuffer {
  const binary = atob(data)
  const view = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) view[i] = binary.charCodeAt(i)
  return view.buffer
}

// Blobs are built only when something needs to be displayed or downloaded.
export function toBlob(bytes: ArrayBuffer, mime: string): Blob {
  return new Blob([bytes], { type: mime })
}
