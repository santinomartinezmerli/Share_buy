// Every cached list that can contain a post: the feed, Explore, a profile's grid and the saved
// posts. They are infinite queries whose pages look like { posts: [...], ... }.
const POST_LIST_KEYS = [['feed'], ['explore'], ['profilePosts'], ['savedPosts']]

// Merge `fields` into one post, by id, in every cached list where it appears. Only those fields
// change: the rest of the post, including the joined profiles (author name and avatar), stays as
// it is. Used by edits that know exactly which columns changed, such as the for_sale switch.
export function patchPostEverywhere(queryClient, postId, fields) {
  for (const queryKey of POST_LIST_KEYS) {
    queryClient.setQueriesData({ queryKey }, (old) => {
      if (!old?.pages) return old
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          posts: page.posts.map((p) => (p.id === postId ? { ...p, ...fields } : p)),
        })),
      }
    })
  }
}
