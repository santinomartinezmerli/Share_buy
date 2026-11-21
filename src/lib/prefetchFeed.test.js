import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { feedKey } from './feedCache'

const getSession = vi.fn()
vi.mock('./supabase', () => ({ supabase: { auth: { getSession } } }))
const fetchFeedPage = vi.fn()
vi.mock('../services/feed', () => ({ fetchFeedPage }))

const { prefetchFeed } = await import('./prefetchFeed')

describe('prefetchFeed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads page 1 into the cache under the same key useFeed uses', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    fetchFeedPage.mockResolvedValue({ posts: [{ id: 'p1' }], nextCursor: undefined })
    const queryClient = new QueryClient()

    await prefetchFeed(queryClient)

    expect(fetchFeedPage).toHaveBeenCalledTimes(1)
    expect(fetchFeedPage).toHaveBeenCalledWith(null)
    expect(queryClient.getQueryData(feedKey('u1')).pages[0].posts).toEqual([{ id: 'p1' }])
  })

  it('does nothing when signed out', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    await prefetchFeed(new QueryClient())
    expect(fetchFeedPage).not.toHaveBeenCalled()
  })

  it('swallows errors: the Feed screen fetches on its own later', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    fetchFeedPage.mockRejectedValue(new Error('network'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(prefetchFeed(new QueryClient())).resolves.toBeUndefined()
  })

  it('does not fetch again when the data is still fresh (a Feed mounting right after reuses it)', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    fetchFeedPage.mockResolvedValue({ posts: [], nextCursor: undefined })
    const queryClient = new QueryClient()
    await prefetchFeed(queryClient)
    await prefetchFeed(queryClient)
    expect(fetchFeedPage).toHaveBeenCalledTimes(1)
  })
})
