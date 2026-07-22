import { describe, expect, it } from 'vitest'
import { parseReceiptJson } from './receiptScan'

describe('parseReceiptJson', () => {
  it('parses a clean JSON object', () => {
    expect(
      parseReceiptJson('{"date":"2026-07-15","cost":68.5,"litres":45.3,"odometer":null}'),
    ).toEqual({ date: '2026-07-15', cost: 68.5, litres: 45.3 })
  })

  it('tolerates markdown fences and prose around the JSON', () => {
    expect(
      parseReceiptJson('Here you go:\n```json\n{"date":"2026-07-15","cost":50}\n```'),
    ).toEqual({ date: '2026-07-15', cost: 50 })
  })

  it('drops malformed dates and negative or non-numeric amounts', () => {
    expect(
      parseReceiptJson('{"date":"15.07.2026","cost":-5,"litres":"a lot","odometer":155200}'),
    ).toEqual({ odometer: 155200 })
  })

  it('returns empty on garbage', () => {
    expect(parseReceiptJson('sorry, I cannot read this')).toEqual({})
    expect(parseReceiptJson('{broken json')).toEqual({})
  })
})
