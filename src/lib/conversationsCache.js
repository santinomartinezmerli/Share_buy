// One cached conversation list per user.
export const conversationsKey = (userId) => ['conversations', userId]

// The number of unread messages of a user, for the badge on the Messages tab.
export const unreadMessagesKey = (userId) => ['unreadMessages', userId]

// Mark every cached conversation list as stale: a message arrived or was sent, so the order, the
// last message and the unread counts changed. If the list is on screen it refetches now; if not,
// it refetches the next time it is shown.
export const invalidateConversations = (queryClient) =>
  queryClient.invalidateQueries({ queryKey: ['conversations'] })

// The unread count changed (a message arrived, or a conversation was marked as read).
export const invalidateUnreadMessages = (queryClient) =>
  queryClient.invalidateQueries({ queryKey: ['unreadMessages'] })
