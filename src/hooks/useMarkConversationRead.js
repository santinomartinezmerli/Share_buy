import { useMemo, useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { markConversationRead } from '../services/chat'
import { markMessagesRead, isTempMessage } from '../lib/messagesCache'
import { invalidateConversations, invalidateUnreadMessages } from '../lib/conversationsCache'

// Mark the open conversation as read through the mark_conversation_read RPC.
//
// It runs when the chat is open, its messages are loaded, the tab is visible and the list has a
// message from the other user that is still unread. That covers both "I just opened the chat"
// and "a message arrived while the chat is open" (Realtime adds it to the list, the list changes,
// the effect runs again). If the message arrives while the tab is hidden, it is marked as soon as
// the tab is visible again.
//
// When the RPC finishes: read_at is set on those messages in the cache (the "new" ones disappear
// without a refetch) and the conversation list and the unread badge are marked as stale.
// If it fails: one console.warn and nothing else. It does not try again for the same set of
// unread messages (no retry loop); a new message, or opening the chat again, tries again.
export function useMarkConversationRead(conversationId, userId, messages, ready) {
  const queryClient = useQueryClient()
  const inFlightRef = useRef(null)     // conversation being marked right now
  const failedRef = useRef(null)       // "conversation:unread ids" that failed last time

  const unreadIds = useMemo(
    () => messages
      .filter((m) => m.sender_id !== userId && !m.read_at && !isTempMessage(m))
      .map((m) => m.id),
    [messages, userId]
  )
  const unreadKey = `${conversationId}:${unreadIds.join(',')}`

  const markNow = useCallback(() => {
    if (!userId || !conversationId || !ready) return
    if (document.visibilityState !== 'visible') return
    if (unreadIds.length === 0) return
    if (inFlightRef.current === conversationId) return
    if (failedRef.current === unreadKey) return

    inFlightRef.current = conversationId
    const ids = unreadIds
    markConversationRead(conversationId)
      .then(() => {
        markMessagesRead(queryClient, conversationId, ids, new Date().toISOString())
        invalidateConversations(queryClient)
        invalidateUnreadMessages(queryClient)
      })
      .catch((err) => {
        failedRef.current = unreadKey
        console.warn('Marking the conversation as read failed:', err?.message ?? err)
      })
      .finally(() => {
        if (inFlightRef.current === conversationId) inFlightRef.current = null
      })
  }, [userId, conversationId, ready, unreadIds, unreadKey, queryClient])

  useEffect(() => { markNow() }, [markNow])

  useEffect(() => {
    document.addEventListener('visibilitychange', markNow)
    return () => document.removeEventListener('visibilitychange', markNow)
  }, [markNow])
}
