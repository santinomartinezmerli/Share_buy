import { useQuery } from '@tanstack/react-query'
import { fetchUnreadMessagesCount } from '../services/conversations'
import { unreadMessagesKey } from '../lib/conversationsCache'

// Unread messages for the badge on the Messages tab: one count query, no rows. It is kept fresh
// by the Realtime channel in Layout and by Chat when it marks a conversation as read.
// `enabled` lets the caller hold the request until the feed has painted (see useDeferredStart).
export function useUnreadMessagesCount(userId, enabled = true) {
  const { data } = useQuery({
    queryKey: unreadMessagesKey(userId),
    queryFn: async () => {
      try {
        return await fetchUnreadMessagesCount()
      } catch (err) {
        console.error('Unread messages count failed:', err)
        throw err
      }
    },
    enabled: !!userId && enabled,
    staleTime: 60_000,
  })
  return data ?? 0
}
