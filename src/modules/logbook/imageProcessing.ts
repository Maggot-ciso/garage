export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024 // 25 MB
export const MAX_IMAGE_EDGE = 1600
export const IMAGE_QUALITY = 0.75

export const ACCEPTED_MIME = 'image/*,application/pdf'

export function isSupportedAttachment(mime: string): boolean {
  return mime.startsWith('image/') || mime === 'application/pdf'
}

export function describeSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function rejectionReason(file: { type: string; size: number }): string | null {
  if (!isSupportedAttachment(file.type)) return 'Only photos and PDFs can be attached'
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `That file is ${describeSize(file.size)} — the limit is ${describeSize(MAX_ATTACHMENT_BYTES)}`
  }
  return null
}

// Longest edge capped, so an iPhone photo lands around a few hundred KB
// instead of several MB. That is what keeps a single-file backup workable.
export function scaledDimensions(
  width: number,
  height: number,
  maxEdge = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const ratio = maxEdge / longest
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}

// Canvas work: not runnable in jsdom, verified in the browser preview.
export async function downscaleImage(file: File): Promise<{ bytes: ArrayBuffer; mime: string }> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = scaledDimensions(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the image')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY),
  )
  if (!blob) throw new Error('Could not process that image')
  return { bytes: await blob.arrayBuffer(), mime: 'image/jpeg' }
}

// PDFs are stored byte-for-byte; there is nothing sensible to downscale.
export async function prepareAttachment(
  file: File,
): Promise<{ bytes: ArrayBuffer; mime: string; name: string }> {
  const reason = rejectionReason(file)
  if (reason) throw new Error(reason)
  if (file.type === 'application/pdf') {
    return { bytes: await file.arrayBuffer(), mime: file.type, name: file.name }
  }
  const { bytes, mime } = await downscaleImage(file)
  return { bytes, mime, name: file.name }
}
