import { useQuery } from '@tanstack/react-query'
import { fetchUnreadMessagesCount } from '../services/conversations'
import { unreadMessagesKey } from '../lib/conversationsCache'

// Unread messages for the badge on the Messages tab: one count query, no rows. It is kept fresh
// by the Realtime channel in Layout and by Chat when it marks a conversation as read.
export function useUnreadMessagesCount(userId) {
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
    enabled: !!userId,
    staleTime: 60_000,
  })
  return data ?? 0
}
