import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { invalidateNotifications } from '../lib/notificationsCache'

// One Realtime channel for the signed-in user's new notifications. It is mounted once, in
// Layout, while there is a session; the Notifications screen does not open its own channel.
// Every INSERT on notifications for this user marks the list and the bell badge as stale: the
// badge refetches its count, and the list refetches only if the screen is open (otherwise it
// shows the new rows the next time it opens).
//
// The cleanup is returned by the effect itself, not by an async function, so React really runs
// it when the user changes (sign out) or Layout unmounts, and the channel is removed.
export function useNotificationsRealtime(userId) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => invalidateNotifications(queryClient, userId)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, queryClient])
}
