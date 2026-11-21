import { supabase } from '../lib/supabase'

export const PROFILE_POSTS_PAGE_SIZE = 24

// Everything the profile header needs, fetched in parallel instead of one request after
// another: the profile row, followers and following counts and, when `viewerId` is looking at
// someone else's profile, whether they follow / blocked that user.
export async function fetchProfileSummary(profileId, viewerId) {
  const isOther = !!viewerId && viewerId !== profileId

  const [profileRes, followersRes, followingRes, followRes, blockRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', profileId).maybeSingle(),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileId),
    isOther
      ? supabase.from('follows').select('id').eq('follower_id', viewerId).eq('following_id', profileId).maybeSingle()
      : null,
    isOther
      ? supabase.from('blocked_users').select('id').eq('blocker_id', viewerId).eq('blocked_id', profileId).maybeSingle()
      : null,
  ])
  if (profileRes.error) throw profileRes.error

  return {
    profile: profileRes.data,
    followersCount: followersRes.count ?? 0,
    followingCount: followingRes.count ?? 0,
    following: !!followRes?.data,
    blocked: !!blockRes?.data,
  }
}

// One page of a user's posts, newest first, for the profile grid. Only the columns the grid
// needs. `cursor` is { created_at, id } of the last post of the previous page, or null.
//
// The first page also returns the total number of posts (`count`), in the same request
// (count: 'exact'). Later pages do not ask for it: with a cursor the count would only cover
// the posts after it.
//
// Fetches PAGE_SIZE + 1 rows to know if there is a next page and returns PAGE_SIZE.
// nextCursor is undefined on the last page, as useInfiniteQuery expects.
export async function fetchProfilePosts(profileId, cursor) {
  const first = !cursor

  let query = supabase
    .from('posts')
    .select('id, created_at, image_url, image_urls', first ? { count: 'exact' } : {})
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PROFILE_POSTS_PAGE_SIZE + 1)

  if (cursor) {
    // (created_at, id) < cursor. created_at is the original ISO string, never a Date, so no
    // microseconds are lost.
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    )
  }

  const { data, error, count } = await query
  if (error) throw error

  const rows = data ?? []
  const hasMore = rows.length > PROFILE_POSTS_PAGE_SIZE
  const posts = hasMore ? rows.slice(0, PROFILE_POSTS_PAGE_SIZE) : rows
  const last = posts[posts.length - 1]

  return {
    posts,
    count: first ? (count ?? posts.length) : undefined,
    nextCursor: hasMore && last ? { created_at: last.created_at, id: last.id } : undefined,
  }
}

// Follow / block. They throw on error so a mutation can roll back its optimistic update.
async function run(query) {
  const { error } = await query
  if (error) throw error
}

export const followUser = (viewerId, targetId) =>
  run(supabase.from('follows').insert({ follower_id: viewerId, following_id: targetId }))

export const unfollowUser = (viewerId, targetId) =>
  run(supabase.from('follows').delete().eq('follower_id', viewerId).eq('following_id', targetId))

export const blockUser = (viewerId, targetId) =>
  run(supabase.from('blocked_users').insert({ blocker_id: viewerId, blocked_id: targetId }))

export const unblockUser = (viewerId, targetId) =>
  run(supabase.from('blocked_users').delete().eq('blocker_id', viewerId).eq('blocked_id', targetId))
