import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()
  const previousUserId = useRef(null)

  // When the signed-in user goes away (sign out, expired session) or becomes a different user, the
  // whole react-query cache is dropped: feed, profiles, Explore and the rest belong to the previous
  // account and must never be shown to the next one. It runs after the render in which the screens
  // were already replaced, so nothing refetches into the empty cache.
  useEffect(() => {
    const previous = previousUserId.current
    previousUserId.current = userId
    if (previous && previous !== userId) queryClient.clear()
  }, [userId, queryClient])

  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      setUserId(session?.user?.id ?? null)
      setLoading(false)
    }

    getInitialSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setUserId(session?.user?.id ?? null)
    })

    return () => {
      listener?.subscription?.unsubscribe()
    }
  }, [])

  const value = {
    session,
    user,
    userId,
    loading,
    isAuthenticated: !!user,
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- provider and hook share one context; splitting files is out of scope
export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
