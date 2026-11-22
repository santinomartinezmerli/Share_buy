import { describe, it, expect } from 'vitest'
import { parsePrice } from './parsePrice'

// The same cases as the comment of parse_price() in 004_explore.sql.
describe('parsePrice', () => {
  it('reads the Argentine format', () => {
    expect(parsePrice('1.500')).toBe(1500)
    expect(parsePrice('1.500,50')).toBe(1500.5)
    expect(parsePrice('12,50')).toBe(12.5)
    expect(parsePrice('12.50')).toBe(12.5)
    expect(parsePrice('$ 1500')).toBe(1500)
    expect(parsePrice('80000')).toBe(80000)
    expect(parsePrice('1.234.567')).toBe(1234567)
  })
  it('returns null when it is not a plain number', () => {
    expect(parsePrice('abc')).toBeNull()
    expect(parsePrice('consultar')).toBeNull()
    expect(parsePrice('10 USD')).toBeNull()
    expect(parsePrice('1,500,000')).toBeNull()
    expect(parsePrice('')).toBeNull()
    expect(parsePrice(null)).toBeNull()
    expect(parsePrice('1'.repeat(16))).toBeNull()
  })
})
