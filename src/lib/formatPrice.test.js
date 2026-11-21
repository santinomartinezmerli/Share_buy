import { describe, it, expect } from 'vitest'
import { formatPrice } from './formatPrice'

describe('formatPrice', () => {
  it('adds the thousands separator of es-AR', () => {
    expect(formatPrice(80000)).toBe('80.000')
    expect(formatPrice('1500000')).toBe('1.500.000')
  })
  it('keeps up to two decimals with a comma', () => {
    expect(formatPrice(1500.5)).toBe('1.500,5')
    expect(formatPrice('12.345')).toBe('12,35')
  })
  it('leaves small numbers alone', () => {
    expect(formatPrice(950)).toBe('950')
    expect(formatPrice(0)).toBe('0')
  })
  it('returns non-numeric values unchanged and null as empty', () => {
    expect(formatPrice('consultar')).toBe('consultar')
    expect(formatPrice(null)).toBe('')
    expect(formatPrice(undefined)).toBe('')
  })
})
