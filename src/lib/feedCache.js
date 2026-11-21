// The feed lives in the react-query cache under one key per user, so switching accounts
// never shows the previous account's feed.
export const feedKey = (userId) => ['feed', userId]

// Apply `patch(post)` (returns the fields to change) to one post inside every cached
// page of the feed. Used by optimistic likes/saves so the cache, and therefore any
// PostCard that mounts later, always agrees with what the user last saw.
export function patchFeedPost(queryClient, userId, postId, patch) {
  queryClient.setQueryData(feedKey(userId), (old) => {
    if (!old) return old
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        posts: page.posts.map((p) => (p.id === postId ? { ...p, ...patch(p) } : p)),
      })),
    }
  })
}
