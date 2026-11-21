import { supabase } from './supabase'
import { feedQueryOptions } from './feedQuery'

// Starts loading page 1 of the feed while React is still mounting, instead of waiting for the
// UserProvider -> App -> Feed render chain to reach useFeed. Called once from main.jsx.
//
// It only needs the user id for the query key: getSession() shares the client's own init
// promise (and its token refresh, if the token is about to expire), so there is no extra auth
// request and no auth logic of ours. Signed out: nothing to do. Any failure is swallowed:
// the Feed screen's own query simply fetches when it mounts.
export async function prefetchFeed(queryClient) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    await queryClient.prefetchInfiniteQuery(feedQueryOptions(session.user.id))
  } catch {
    // intentionally ignored, see above
  }
}
