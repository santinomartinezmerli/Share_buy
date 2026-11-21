import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { addLike, removeLike } from '../services/engagement'
import { feedKey, invalidateFeed, patchFeedPost } from '../lib/feedCache'
import { patchPostEverywhere } from '../lib/postCache'

// Like for the post detail screen. Unlike the feed card, the detail does not read the post from
// a cached list (it may have been opened from a profile grid), so it keeps its own { liked, count }
// and the screen gives it the real values with `init` once they are loaded.
//
// On every change the heart flips at once here and in the lists that already exist in the cache
// (feed, Explore, profile grid, saved), so going back shows the same heart. If the request fails,
// everything goes back to the previous value. The feed is then marked stale, like useExploreLike does.
export function usePostDetailLike(postId, userId) {
  const queryClient = useQueryClient()
  const [state, setState] = useState({ liked: false, count: 0 })
  // The latest state and the "request in flight" flag live in refs so toggle() never reads a stale
  // value (a double tap fires twice before React re-renders).
  const stateRef = useRef(state)
  const pendingRef = useRef(false)

  const commit = useCallback((next) => {
    stateRef.current = next
    setState(next)
  }, [])

  const init = useCallback((liked, count) => commit({ liked: !!liked, count: count ?? 0 }), [commit])

  // Moves every cached copy of the post to `liked` (+1 or -1 on the feed's counter).
  const patchCaches = useCallback((liked) => {
    patchFeedPost(queryClient, userId, postId, (p) => ({
      liked_by_me: liked,
      like_count: Math.max(0, (p.like_count ?? 0) + (liked ? 1 : -1)),
    }))
    patchPostEverywhere(queryClient, postId, { liked_by_me: liked })
  }, [queryClient, userId, postId])

  const toggle = useCallback(async () => {
    if (!userId || !postId || pendingRef.current) return
    pendingRef.current = true
    const before = stateRef.current
    const liked = !before.liked

    // A refetch landing now would overwrite the optimistic value.
    await Promise.all([
      queryClient.cancelQueries({ queryKey: feedKey(userId) }),
      queryClient.cancelQueries({ queryKey: ['explore'] }),
    ])
    commit({ liked, count: Math.max(0, before.count + (liked ? 1 : -1)) })
    patchCaches(liked)

    try {
      await (liked ? addLike(postId, userId) : removeLike(postId, userId))
    } catch (err) {
      console.error('Changing the like failed:', err)
      commit(before)
      patchCaches(before.liked)
    } finally {
      pendingRef.current = false
      invalidateFeed(queryClient)
    }
  }, [userId, postId, queryClient, commit, patchCaches])

  // Double tap on the photo: it only likes, it never takes a like away.
  const like = useCallback(() => {
    if (!stateRef.current.liked) toggle()
  }, [toggle])

  return { liked: state.liked, likesCount: state.count, toggleLike: toggle, likeOnly: like, init }
}
