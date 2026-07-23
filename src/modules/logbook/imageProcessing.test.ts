import { describe, expect, it } from 'vitest'
import {
  describeSize,
  isSupportedAttachment,
  MAX_ATTACHMENT_BYTES,
  rejectionReason,
  scaledDimensions,
} from './imageProcessing'

describe('isSupportedAttachment', () => {
  it('accepts images and PDFs, rejects everything else', () => {
    expect(isSupportedAttachment('image/jpeg')).toBe(true)
    expect(isSupportedAttachment('image/heic')).toBe(true)
    expect(isSupportedAttachment('application/pdf')).toBe(true)
    expect(isSupportedAttachment('video/mp4')).toBe(false)
    expect(isSupportedAttachment('text/plain')).toBe(false)
  })
})

describe('rejectionReason', () => {
  it('passes a normal photo', () => {
    expect(rejectionReason({ type: 'image/jpeg', size: 3_000_000 })).toBeNull()
  })

  it('rejects an unsupported type', () => {
    expect(rejectionReason({ type: 'video/mp4', size: 10 })).toBe('validate.attachmentType')
  })

  it('rejects an oversized file and says how big it was', () => {
    const reason = rejectionReason({ type: 'application/pdf', size: MAX_ATTACHMENT_BYTES + 1 })
    // The sizes travel as vars so the screen can put them into either language.
    expect(reason).toEqual({
      key: 'validate.attachmentTooBig',
      vars: { size: '25.0 MB', limit: '25.0 MB' },
    })
  })
})

describe('scaledDimensions', () => {
  it('leaves a small image alone', () => {
    expect(scaledDimensions(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('caps the longest edge and keeps the aspect ratio', () => {
    expect(scaledDimensions(4032, 3024)).toEqual({ width: 1600, height: 1200 })
    expect(scaledDimensions(3024, 4032)).toEqual({ width: 1200, height: 1600 })
  })

  it('handles a square and an exact-limit image', () => {
    expect(scaledDimensions(2000, 2000)).toEqual({ width: 1600, height: 1600 })
    expect(scaledDimensions(1600, 900)).toEqual({ width: 1600, height: 900 })
  })
})

describe('describeSize', () => {
  it('scales the unit to the size', () => {
    expect(describeSize(512)).toBe('512 B')
    expect(describeSize(2048)).toBe('2 KB')
    expect(describeSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
