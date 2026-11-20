import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// initialLiked / initialCount come from get_feed (liked_by_me, like_count), so the hook
// no longer makes its own count + "did I like it" requests per post.
export function useLike(postId, userId, initialLiked = false, initialCount = 0) {
  const [liked, setLiked] = useState(initialLiked)
  const [likesCount, setLikesCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  const toggleLike = useCallback(async () => {
    if (!userId || loading) return
    setLoading(true)
    const wasLiked = liked
    setLiked(!wasLiked)
    setLikesCount(prev => prev + (wasLiked ? -1 : 1))

    if (wasLiked) {
      const { error } = await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId)
      if (error) {
        setLiked(true)
        setLikesCount(prev => prev + 1)
      }
    } else {
      const { error } = await supabase.from('likes').insert({ post_id: postId, user_id: userId })
      if (error) {
        setLiked(false)
        setLikesCount(prev => prev - 1)
      }
    }
    setLoading(false)
  }, [liked, loading, postId, userId])

  return { liked, likesCount, toggleLike, loading }
}
