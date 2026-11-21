// One cached list per user and per set of filters, so going back to a search you
// already made is instant. All of them share the ['explore'] prefix.
export const exploreKey = (userId, filters) => ['explore', userId, filters]

// Apply `patch(post)` (returns the fields to change) to one post in EVERY cached
// Explore list, whatever filters it was fetched with. Used by the optimistic like
// so the heart is right in all of them.
export function patchExplorePost(queryClient, postId, patch) {
  queryClient.setQueriesData({ queryKey: ['explore'] }, (old) => {
    if (!old?.pages) return old
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        posts: page.posts.map((p) => (p.id === postId ? { ...p, ...patch(p) } : p)),
      })),
    }
  })
}
