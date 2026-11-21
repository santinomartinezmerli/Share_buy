// Query keys of the notifications screen and the bell badge. userId is part of every key so a
// second account on the same browser never sees the first one's cached data.
export const notificationsKey = (userId) => ['notifications', userId]
export const unreadNotificationsKey = (userId) => ['notificationsUnread', userId]
export const reviewRemindersKey = (userId) => ['reviewReminders', userId]

// A notification arrived (Realtime) or was read: the list and the badge are stale. The list on
// screen refetches, which is what makes a new notification appear without leaving the screen.
export function invalidateNotifications(queryClient, userId) {
  queryClient.invalidateQueries({ queryKey: notificationsKey(userId) })
  queryClient.invalidateQueries({ queryKey: unreadNotificationsKey(userId) })
}

// Everything was marked as read: the badge goes to 0 right away, without waiting for a request,
// and is confirmed by the refetch that follows.
export function clearUnreadNotifications(queryClient, userId) {
  queryClient.setQueryData(unreadNotificationsKey(userId), 0)
  queryClient.invalidateQueries({ queryKey: unreadNotificationsKey(userId) })
}

// The screen was closed: mark every cached row as read (they were, in the database, when the
// screen opened) so the next visit within the cache time shows them as already seen.
export function markCachedNotificationsRead(queryClient, userId) {
  const now = new Date().toISOString()
  queryClient.setQueryData(notificationsKey(userId), (old) => {
    if (!old?.pages) return old
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        notifications: page.notifications.map((n) => (n.read_at ? n : { ...n, read_at: now })),
      })),
    }
  })
}
