import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

let authListener
const session = (id) => ({ user: { id } })
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: session('user-a') } })),
      onAuthStateChange: vi.fn((cb) => { authListener = cb; return { data: { subscription: { unsubscribe() {} } } } }),
    },
  },
}))
import { UserProvider } from './UserContext.jsx'

async function mount() {
  const queryClient = new QueryClient()
  queryClient.setQueryData(['feed', 'user-a'], { pages: [] })
  queryClient.setQueryData(['profile', 'user-a'], { name: 'A' })
  await act(async () => {
    render(<QueryClientProvider client={queryClient}><UserProvider><div /></UserProvider></QueryClientProvider>)
  })
  return queryClient
}

describe('UserProvider cache cleanup', () => {
  it('keeps the cache while the same user stays signed in (token refresh)', async () => {
    const queryClient = await mount()
    await act(async () => { authListener('TOKEN_REFRESHED', session('user-a')) })
    expect(queryClient.getQueryData(['feed', 'user-a'])).toBeDefined()
  })

  it('clears every query when the user signs out', async () => {
    const queryClient = await mount()
    await act(async () => { authListener('SIGNED_OUT', null) })
    expect(queryClient.getQueryData(['feed', 'user-a'])).toBeUndefined()
    expect(queryClient.getQueryData(['profile', 'user-a'])).toBeUndefined()
  })

  it('clears the cache when a different user takes over the session', async () => {
    const queryClient = await mount()
    await act(async () => { authListener('SIGNED_IN', session('user-b')) })
    expect(queryClient.getQueryData(['feed', 'user-a'])).toBeUndefined()
  })
})
