import { parsePrice } from './parsePrice'

// How a price looks in a pill: "$" is added by the caller. A price the app can read gets the es-AR
// thousands separator ("80000" -> "80.000", "1.500,5" -> "1.500,50"). One it cannot read ("consultar",
// "10 USD") is shown as typed, without its own leading "$": showing the original text is better than
// showing a wrong number.
export function formatPrice(price) {
  if (price === null || price === undefined) return ''
  const value = parsePrice(price)
  if (value === null) return String(price).trim().replace(/^\$\s*/, '')
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}
