import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Attachment } from '../../db/db'
import { shareVehicleDocument } from './vehicleDocuments'

const doc: Attachment = {
  id: 'a1',
  carId: 'car-1',
  name: 'pzp.pdf',
  mime: 'application/pdf',
  size: 3,
  bytes: new Uint8Array([1, 2, 3]).buffer,
  createdAt: '2026-07-22T10:00:00.000Z',
}

// jsdom implements neither of these. Assigning onto the real URL object means
// they survive unstubAllGlobals, so they are reset explicitly instead.
const createObjectURL = vi.fn(() => 'blob:pzp')
const revokeObjectURL = vi.fn()
Object.assign(URL, { createObjectURL, revokeObjectURL })

beforeEach(() => {
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
})

function withShare(share: (data: unknown) => Promise<void>) {
  vi.stubGlobal('navigator', {
    ...navigator,
    share,
    canShare: () => true,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('sharing a vehicle document', () => {
  it('hands the file to the OS share sheet when it can', async () => {
    const share = vi.fn(async () => {})
    withShare(share)
    const open = vi.spyOn(window, 'open')

    expect(await shareVehicleDocument(doc)).toBe('shared')
    expect(share).toHaveBeenCalledOnce()
    // No second copy opened in a tab behind the sheet
    expect(open).not.toHaveBeenCalled()
  })

  it('treats a dismissed share sheet as done, not as a failure', async () => {
    withShare(async () => {
      throw new DOMException('cancelled', 'AbortError')
    })
    const open = vi.spyOn(window, 'open')

    expect(await shareVehicleDocument(doc)).toBe('shared')
    expect(open).not.toHaveBeenCalled()
  })

  it('falls back to a new tab when the share sheet is unavailable', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined, canShare: undefined })
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window)

    expect(await shareVehicleDocument(doc)).toBe('opened')
    expect(open).toHaveBeenCalledWith('blob:pzp', '_blank')
    expect(document.querySelector('a[href="blob:pzp"]')).toBeNull()
  })

  it('falls back to a new tab when sharing fails for a real reason', async () => {
    withShare(async () => {
      throw new Error('not allowed')
    })
    vi.spyOn(window, 'open').mockReturnValue({} as Window)

    expect(await shareVehicleDocument(doc)).toBe('opened')
  })

  it('clicks a real link when the popup blocker refuses window.open', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined, canShare: undefined })
    vi.spyOn(window, 'open').mockReturnValue(null)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    // 'uncertain', not 'opened': an anchor click reports nothing back, so
    // claiming success here would be a guess.
    expect(await shareVehicleDocument(doc)).toBe('uncertain')
    expect(click).toHaveBeenCalledOnce()
  })

  it('does not leave the fallback link in the document', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined, canShare: undefined })
    vi.spyOn(window, 'open').mockReturnValue(null)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await shareVehicleDocument(doc)
    expect(document.querySelector('a[href="blob:pzp"]')).toBeNull()
  })

  it('releases the object URL once the tab has had time to read it', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { ...navigator, share: undefined, canShare: undefined })
    vi.spyOn(window, 'open').mockReturnValue({} as Window)

    await shareVehicleDocument(doc)
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pzp')
    vi.useRealTimers()
  })
})
