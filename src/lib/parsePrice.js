// Prices are free text in the database ("$1.500", "12,50", "80000"). This reads them exactly like
// public.parse_price() in supabase/migrations/004_explore.sql, so the app and the Explore filters
// agree. Argentine format: "$" and spaces are ignored, "." separates thousands and "," the decimals.
//   '1.500' -> 1500   '1.500,50' -> 1500.5   '12,50' -> 12.5   '12.50' -> 12.5   '$ 1500' -> 1500
// Anything else ("consultar", "10 USD", "1,500,000") returns null: no guess is better than a wrong number.
// Known ambiguity, same as in SQL: '1.234' is read as 1234 (thousands), not 1.234.
export function parsePrice(text) {
  if (text === null || text === undefined) return null
  const t = String(text).replace(/[$\s]/g, '')
  if (t.length === 0 || t.length > 15) return null
  if (/^[0-9]{1,3}(\.[0-9]{3})+(,[0-9]+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'))
  if (/^[0-9]+,[0-9]+$/.test(t)) return Number(t.replace(',', '.'))
  if (/^[0-9]+(\.[0-9]+)?$/.test(t)) return Number(t)
  return null
}
