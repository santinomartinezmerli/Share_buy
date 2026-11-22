import { describe, it, expect } from 'vitest'
import { formatPrice } from './formatPrice'

describe('formatPrice', () => {
  it('adds the thousands separator of es-AR', () => {
    expect(formatPrice('80000')).toBe('80.000')
    expect(formatPrice(80000)).toBe('80.000')
    expect(formatPrice('1500000')).toBe('1.500.000')
  })
  it('does not turn a price written with a thousands dot into a decimal', () => {
    expect(formatPrice('1.500')).toBe('1.500')
    expect(formatPrice('$1.500')).toBe('1.500')
  })
  it('shows two decimals when there are decimals', () => {
    expect(formatPrice('1.500,5')).toBe('1.500,50')
    expect(formatPrice('12,50')).toBe('12,50')
  })
  it('leaves small numbers alone', () => {
    expect(formatPrice('950')).toBe('950')
    expect(formatPrice('0')).toBe('0')
  })
  it('shows what was typed when it cannot be read, without a second "$"', () => {
    expect(formatPrice('consultar')).toBe('consultar')
    expect(formatPrice('10 USD')).toBe('10 USD')
    expect(formatPrice('$ 10 USD')).toBe('10 USD')
  })
  it('returns empty for null or undefined', () => {
    expect(formatPrice(null)).toBe('')
    expect(formatPrice(undefined)).toBe('')
  })
})
