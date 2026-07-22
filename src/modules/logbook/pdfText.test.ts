import { describe, expect, it } from 'vitest'
import { isPdf, textContentToLines } from './pdfText'

// pdf.js transform: [a, b, c, d, x, y] — index 4 is x, index 5 is the baseline
const item = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] })

describe('isPdf', () => {
  it('detects by mime type and by extension', () => {
    expect(isPdf(new File([], 'a.bin', { type: 'application/pdf' }))).toBe(true)
    expect(isPdf(new File([], 'invoice.PDF'))).toBe(true)
    expect(isPdf(new File([], 'photo.jpg', { type: 'image/jpeg' }))).toBe(false)
  })
})

describe('textContentToLines', () => {
  it('groups fragments on the same baseline into one line', () => {
    const content = {
      items: [item('Celkom k platbe:', 50, 200), item('1 234,00 €', 400, 200)],
    }
    expect(textContentToLines(content)).toBe('Celkom k platbe: 1 234,00 €')
  })

  it('orders lines top to bottom and fragments left to right', () => {
    const content = {
      items: [
        item('€', 420, 100),
        item('Spolu', 50, 100),
        item('71,98', 380, 100),
        item('SLOVNAFT', 50, 300),
      ],
    }
    expect(textContentToLines(content)).toBe('SLOVNAFT\nSpolu 71,98 €')
  })

  it('ignores empty fragments and items without text', () => {
    const content = { items: [item('', 10, 50), { foo: 'bar' }, item('Suma 12,00', 10, 80)] }
    expect(textContentToLines(content)).toBe('Suma 12,00')
  })

  it('returns an empty string for a page with no text layer', () => {
    expect(textContentToLines({ items: [] })).toBe('')
  })
})
