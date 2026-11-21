import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { invalidateNotifications, handleNotificationDeleted } from '../lib/notificationsCache'

// One Realtime channel for the signed-in user's notifications, new and removed. It is mounted once, in
// Layout, while there is a session; the Notifications screen does not open its own channel.
// Every INSERT on notifications for this user marks the list and the bell badge as stale: the
// badge refetches its count, and the list refetches only if the screen is open (otherwise it
// shows the new rows the next time it opens).
//
// A DELETE (the like or follow was undone, the comment was deleted) cannot be filtered by user_id
// and only carries the id, so it is checked against the loaded list: only if that notification is
// in it, the list and the badge are marked as stale. Same channel, no second subscription.
//
// The cleanup is returned by the effect itself, not by an async function, so React really runs
// it when the user changes (sign out) or Layout unmounts, and the channel is removed.
// `enabled` lets Layout open the channel after the feed has painted (see useDeferredStart).
export function useNotificationsRealtime(userId, enabled = true) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId || !enabled) return

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => invalidateNotifications(queryClient, userId)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications' },
        (payload) => handleNotificationDeleted(queryClient, userId, payload)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, enabled, queryClient])
}
