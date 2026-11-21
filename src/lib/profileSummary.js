const clean = (value) => (typeof value === 'string' ? value.trim() : '')

// From the rows of a user's posts ({ where_bought, category }) work out the two numbers the profile
// strip shows besides the post count: how many different stores, and the most frequent category.
// Stores are compared without caring for case or spaces ("Zara" and " zara "). On a tie the category
// that appears first (the most recent post) wins.
export function summarizePosts(rows) {
  const stores = new Set()
  const categories = new Map()
  for (const row of rows ?? []) {
    const store = clean(row.where_bought).toLowerCase()
    if (store) stores.add(store)
    const category = clean(row.category)
    if (category) categories.set(category, (categories.get(category) ?? 0) + 1)
  }
  let topCategory = null
  let best = 0
  for (const [category, count] of categories) {
    if (count > best) { topCategory = category; best = count }
  }
  return { storesCount: stores.size, topCategory }
}
