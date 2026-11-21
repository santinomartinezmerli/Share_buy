import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { feedKey } from '../lib/feedCache'
import { whenIdle } from '../lib/whenIdle'

// The feed is what the user came to see, so the extras (unread badges and Realtime channels)
// start after it has been painted, not while it is still loading: they would compete with
// get_feed for the network and the main thread.
//
// Returns false until the feed query has finished (data or error) and the browser is idle. If the
// current screen is not the feed (`waitForFeed: false`) it only waits for idle. A fallback timer
// guarantees it turns true even if the feed never settles (offline, paused query).
// Once true it stays true.
const FALLBACK_MS = 4000

export function useDeferredStart(userId, { waitForFeed }) {
  const queryClient = useQueryClient()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!userId || ready) return
    let cancelIdle = () => {}
    let started = false

    const start = () => {
      if (started) return
      started = true
      unsubscribe()
      cancelIdle = whenIdle(() => setReady(true))
    }
    const feedSettled = () => {
      const status = queryClient.getQueryState(feedKey(userId))?.status
      return status === 'success' || status === 'error'
    }

    const cache = queryClient.getQueryCache()
    const unsubscribe = waitForFeed ? cache.subscribe(() => { if (feedSettled()) start() }) : () => {}
    const fallback = setTimeout(start, FALLBACK_MS)
    if (!waitForFeed || feedSettled()) start()

    return () => {
      unsubscribe()
      clearTimeout(fallback)
      cancelIdle()
    }
  }, [userId, waitForFeed, ready, queryClient])

  return ready
}
