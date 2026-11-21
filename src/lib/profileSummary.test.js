import { describe, it, expect } from 'vitest'
import { summarizePosts } from './profileSummary'

describe('summarizePosts', () => {
  it('counts distinct stores ignoring case and spaces', () => {
    const rows = [{ where_bought: 'Zara' }, { where_bought: ' zara ' }, { where_bought: 'Nike' }, { where_bought: null }, { where_bought: '' }]
    expect(summarizePosts(rows).storesCount).toBe(2)
  })

  it('finds the most frequent category', () => {
    const rows = [{ category: 'Ropa' }, { category: 'Tech' }, { category: 'Ropa' }, { category: null }]
    expect(summarizePosts(rows).topCategory).toBe('Ropa')
  })

  it('breaks a tie with the most recent post (first row)', () => {
    expect(summarizePosts([{ category: 'Tech' }, { category: 'Ropa' }]).topCategory).toBe('Tech')
  })

  it('handles no posts or no data', () => {
    expect(summarizePosts([])).toEqual({ storesCount: 0, topCategory: null })
    expect(summarizePosts(undefined)).toEqual({ storesCount: 0, topCategory: null })
  })
})
