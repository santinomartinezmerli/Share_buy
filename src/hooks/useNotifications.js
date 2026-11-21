import { useMemo, useCallback, useEffect } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchNotificationsPage,
  fetchUnreadNotificationsCount,
  fetchReviewReminders,
  markAllNotificationsRead,
} from '../services/notifications'
import {
  notificationsKey,
  unreadNotificationsKey,
  reviewRemindersKey,
  clearUnreadNotifications,
  markCachedNotificationsRead,
} from '../lib/notificationsCache'

// The user's notifications, 30 per page, newest first. New ones arrive through the Realtime
// channel mounted in Layout, which invalidates this query.
export function useNotifications(userId) {
  const query = useInfiniteQuery({
    queryKey: notificationsKey(userId),
    queryFn: async ({ pageParam }) => {
      try {
        return await fetchNotificationsPage(userId, pageParam)
      } catch (err) {
        console.error('Notifications request failed:', err)
        throw err
      }
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!userId,
    staleTime: 60_000,
  })

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = query

  const notifications = useMemo(() => data?.pages.flatMap((page) => page.notifications) ?? [], [data])

  // After a failed "load more" stop paginating instead of retrying in a loop
  // (the scroll observer would fire again immediately).
  const hasMore = !!hasNextPage && !isFetchNextPageError

  const loadMore = useCallback(() => {
    if (!hasMore || isFetchingNextPage) return
    fetchNextPage()
  }, [hasMore, isFetchingNextPage, fetchNextPage])

  return { notifications, loading: query.isPending, loadingMore: isFetchingNextPage, hasMore, loadMore }
}

// Unread notifications, for the badge on the bell. A single count query, no rows.
export function useUnreadNotificationsCount(userId) {
  const { data } = useQuery({
    queryKey: unreadNotificationsKey(userId),
    queryFn: async () => {
      try {
        return await fetchUnreadNotificationsCount(userId)
      } catch (err) {
        console.error('Unread notifications count failed:', err)
        throw err
      }
    },
    enabled: !!userId,
    staleTime: 60_000,
  })
  return data ?? 0
}

// Posts that reached the review reminder period and have no review yet (see REVIEW_REMINDER_DAYS).
export function useReviewReminders(userId) {
  const { data } = useQuery({
    queryKey: reviewRemindersKey(userId),
    queryFn: async () => {
      try {
        return await fetchReviewReminders()
      } catch (err) {
        console.error('Review reminders request failed:', err)
        throw err
      }
    },
    enabled: !!userId,
    staleTime: 60_000,
  })
  return data ?? []
}

// Mark everything as read while the Notifications screen is open. `unreadShown` is how many
// loaded rows are still unread: it runs once when the screen opens with unread rows and again
// if a new notification arrives while it is open. The badge goes to 0 right away. The rows keep
// their "new" look during the visit; when the screen closes the cached rows are marked as read,
// so coming back within the cache time does not show them as new again.
export function useMarkNotificationsRead(userId, unreadShown) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId || unreadShown === 0) return
    let cancelled = false
    markAllNotificationsRead(userId)
      .then(() => { if (!cancelled) clearUnreadNotifications(queryClient, userId) })
      .catch((err) => console.error('Marking notifications as read failed:', err))
    return () => { cancelled = true }
  }, [userId, unreadShown, queryClient])

  useEffect(() => {
    if (!userId) return
    return () => markCachedNotificationsRead(queryClient, userId)
  }, [userId, queryClient])
}
