import { supabase } from '../lib/supabase'
import { REVIEW_REMINDER_DAYS } from '../lib/constants'

export const NOTIFICATIONS_PAGE_SIZE = 30

// One page of the signed-in user's notifications, newest first.
//
// Row level security already limits the table to the user's own rows; user_id is filtered too
// so the query uses idx_notifications_user_created (user_id, created_at DESC, id DESC).
// Each row carries the actor (who liked, commented or followed) and, for likes and comments,
// the post. `cursor` is { created_at, id } of the last row of the previous page, or null;
// created_at travels as the original ISO string so no microseconds are lost.
//
// Fetches PAGE_SIZE + 1 rows to know if there is a next page and returns PAGE_SIZE.
// nextCursor is undefined on the last page, as useInfiniteQuery expects.
export async function fetchNotificationsPage(userId, cursor) {
  let query = supabase
    .from('notifications')
    .select(
      'id, type, post_id, comment_id, preview, created_at, read_at, ' +
      'actor:actor_id(id, username, avatar_url), post:post_id(id, product)'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(NOTIFICATIONS_PAGE_SIZE + 1)

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    )
  }

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  const hasMore = rows.length > NOTIFICATIONS_PAGE_SIZE
  const page = hasMore ? rows.slice(0, NOTIFICATIONS_PAGE_SIZE) : rows
  const last = page[page.length - 1]

  return {
    notifications: page,
    nextCursor: hasMore && last ? { created_at: last.created_at, id: last.id } : undefined,
  }
}

// How many notifications the user has not read (the badge on the bell). A count only: no rows
// travel. Uses the partial index idx_notifications_unread.
export async function fetchUnreadNotificationsCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

// Mark every unread notification of the user as read. Only read_at can be updated (column
// privilege) and only on the user's own rows (RLS). Returns how many rows changed.
export async function markAllNotificationsRead(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

// The user's own posts that are REVIEW_REMINDER_DAYS old or more and have no review of theirs,
// newest first (the RPC returns at most 50): { id, product, created_at, days_since }.
export async function fetchReviewReminders() {
  const { data, error } = await supabase.rpc('get_review_reminders', { p_days: REVIEW_REMINDER_DAYS })
  if (error) throw error
  return data ?? []
}
