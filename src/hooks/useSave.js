import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// initialSaved comes from get_feed (saved_by_me), so the hook no longer makes its own
// request per post.
export function useSave(postId, userId, initialSaved = false) {
  const [saved, setSaved] = useState(initialSaved)
  const [loading, setLoading] = useState(false)

  const toggleSave = useCallback(async (e) => {
    if (e) e.stopPropagation()
    if (!userId || loading) return
    setLoading(true)
    const wasSaved = saved
    setSaved(!wasSaved)

    if (wasSaved) {
      const { error } = await supabase.from('saves').delete().eq('post_id', postId).eq('user_id', userId)
      if (error) setSaved(true)
    } else {
      const { error } = await supabase.from('saves').insert({ post_id: postId, user_id: userId })
      if (error) setSaved(false)
    }
    setLoading(false)
  }, [saved, loading, postId, userId])

  return { saved, toggleSave, loading }
}
