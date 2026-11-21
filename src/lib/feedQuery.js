import { infiniteQueryOptions } from '@tanstack/react-query'
import { fetchFeedPage } from '../services/feed'
import { feedKey } from './feedCache'

// The one definition of the feed query. useFeed (the screen) and prefetchFeed (app startup) both
// use it, so they always share the same key and the same fetching, and a prefetch is picked up
// by the screen instead of fetching twice.
export const feedQueryOptions = (userId) => infiniteQueryOptions({
  queryKey: feedKey(userId),
  queryFn: async ({ pageParam }) => {
    try {
      return await fetchFeedPage(pageParam)
    } catch (err) {
      console.error('Feed request failed:', err)
      throw err
    }
  },
  initialPageParam: null,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  // Within 60s coming back to the feed costs no request. Anything that changes the feed
  // calls invalidateFeed() (see lib/feedCache.js), which forces a refetch on the next
  // visit; older data is shown instantly and refreshed in the background.
  staleTime: 60_000,
})
