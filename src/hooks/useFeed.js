import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 10

// One request per page: the get_feed RPC (supabase/migrations/002_get_feed.sql) already
// applies follows/blocked filtering and returns the author profile, like_count,
// liked_by_me and saved_by_me. has_more comes back on every row; the server fetches
// PAGE_SIZE + 1 internally, so a page that ends exactly on the last post is detected.
//
// The cursor is the last post's (created_at, id). created_at is passed back as the
// original ISO string, not a Date, so no microseconds are lost.
async function fetchFeedPage(cursor) {
  const { data, error } = await supabase.rpc('get_feed', {
    p_limit: PAGE_SIZE,
    p_cursor_created_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null,
  })
  if (error) throw error
  const rows = data ?? []
  return { rows, hasMore: rows[0]?.has_more ?? false }
}

export function useFeed(userId) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const refreshFeed = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const { rows, hasMore: more } = await fetchFeedPage(null)
      setPosts(rows)
      setHasMore(more)
    } catch (err) {
      console.error('Feed refresh failed:', err)
    }
    setLoading(false)
  }, [userId])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !userId) return
    const last = posts[posts.length - 1]
    if (!last) return
    setLoadingMore(true)
    try {
      const { rows, hasMore: more } = await fetchFeedPage({ created_at: last.created_at, id: last.id })
      setPosts(prev => [...prev, ...rows])
      setHasMore(more)
    } catch (err) {
      // Stop paginating instead of retrying in a loop (the scroll observer would re-fire).
      console.error('Feed loadMore failed:', err)
      setHasMore(false)
    }
    setLoadingMore(false)
  }, [loadingMore, hasMore, userId, posts])

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      if (!userId) return
      setLoading(true)
      try {
        const { rows, hasMore: more } = await fetchFeedPage(null)
        if (cancelled) return
        setPosts(rows)
        setHasMore(more)
      } catch (err) {
        console.error('Feed load failed:', err)
      }
      if (!cancelled) setLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    window.__ptrRefresh = refreshFeed
    const handler = () => refreshFeed()
    window.addEventListener('ptr-refresh', handler)
    return () => {
      window.removeEventListener('ptr-refresh', handler)
      window.__ptrRefresh = null
    }
  }, [refreshFeed])

  return { posts, loading, loadingMore, hasMore, loadMore, refreshFeed }
}
