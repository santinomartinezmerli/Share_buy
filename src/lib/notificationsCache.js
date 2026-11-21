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

// A notification was deleted (someone unliked, unfollowed or deleted a comment). Realtime cannot
// filter DELETE events by user_id, and the payload only has the id, so this event reaches
// everybody who listens. It matters only if that id is in a page of the list that is loaded;
// then the list and the badge are stale. Any other id is somebody else's, or one that is not
// loaded, and is ignored. Returns true when it invalidated.
export function handleNotificationDeleted(queryClient, userId, payload) {
  const id = payload?.old?.id
  if (!id) return false
  const cached = queryClient.getQueryData(notificationsKey(userId))
  const isLoaded = !!cached?.pages?.some((page) => page.notifications.some((n) => n.id === id))
  if (!isLoaded) return false
  invalidateNotifications(queryClient, userId)
  return true
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
