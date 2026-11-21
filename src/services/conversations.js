import { supabase } from '../lib/supabase'

export const CONVERSATIONS_PAGE_SIZE = 20

// One page of the conversation list through the get_conversations RPC
// (supabase/migrations/008_read_receipts.sql): the other user, the last message, its date and the
// unread count, most recently active first. Blocked users are excluded in SQL.
//
// unread_count is the real number of messages the other user sent me with read_at IS NULL, so it
// comes from the server and is the same on every device.
// `cursor` is { last_message_at, id } of the last conversation of the previous page, or null.
// last_message_at is passed back as the original ISO string, never a Date, so no microseconds
// are lost.
//
// Returns { conversations, nextCursor }; nextCursor is undefined when there is no next page, which
// is what useInfiniteQuery's getNextPageParam expects. has_more comes back on every row.
export async function fetchConversationsPage(cursor) {
  const { data, error } = await supabase.rpc('get_conversations', {
    p_limit: CONVERSATIONS_PAGE_SIZE,
    p_cursor_last_message_at: cursor?.last_message_at ?? null,
    p_cursor_id: cursor?.id ?? null,
  })
  if (error) throw error

  const conversations = data ?? []
  const last = conversations[conversations.length - 1]
  const hasMore = conversations[0]?.has_more ?? false
  return {
    conversations,
    nextCursor: hasMore && last ? { last_message_at: last.last_message_at, id: last.id } : undefined,
  }
}

// How many messages I have not read in all my conversations (the badge on the Messages tab).
// A single count in SQL (get_unread_messages_count); conversations with users I blocked are not
// counted, the same rule the list uses.
export async function fetchUnreadMessagesCount() {
  const { data, error } = await supabase.rpc('get_unread_messages_count')
  if (error) throw error
  return Number(data) || 0
}
