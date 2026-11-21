import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addSave, removeSave } from '../services/engagement'
import { feedKey, patchFeedPost } from '../lib/feedCache'

// Same idea as useLike: state comes from the cached post and is patched optimistically.
export function useSave(post, userId) {
  const queryClient = useQueryClient()

  const setSaved = (saved) =>
    patchFeedPost(queryClient, userId, post.id, () => ({ saved_by_me: saved }))

  const { mutate, isPending } = useMutation({
    mutationFn: ({ wasSaved }) => (wasSaved ? removeSave(post.id, userId) : addSave(post.id, userId)),
    onMutate: async ({ wasSaved }) => {
      await queryClient.cancelQueries({ queryKey: feedKey(userId) })
      setSaved(!wasSaved)
    },
    onError: (_err, { wasSaved }) => setSaved(wasSaved),
  })

  const toggleSave = useCallback((e) => {
    if (e) e.stopPropagation()
    if (!userId || isPending) return
    mutate({ wasSaved: !!post.saved_by_me })
  }, [userId, isPending, mutate, post.saved_by_me])

  return { saved: !!post.saved_by_me, toggleSave, loading: isPending }
}
