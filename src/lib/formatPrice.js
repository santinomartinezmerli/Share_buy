// "80000" -> "80.000", 1500.5 -> "1.500,5". Prices are stored as plain numbers; this only changes how
// they look. Anything that is not a number is shown as it came.
export function formatPrice(price) {
  const value = Number(price)
  if (price === null || price === undefined || price === '' || !Number.isFinite(value)) return String(price ?? '')
  return value.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}
