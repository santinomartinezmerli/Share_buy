import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { feedKey } from '../lib/feedCache'
import { useDeferredStart } from './useDeferredStart'

const USER = 'user-1'

function setup(options) {
  const queryClient = new QueryClient()
  const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const view = renderHook(() => useDeferredStart(USER, options), { wrapper })
  return { queryClient, view }
}

describe('useDeferredStart', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('stays false while the feed is loading, then turns true once it has data and the browser is idle', () => {
    const { queryClient, view } = setup({ waitForFeed: true })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(view.result.current).toBe(false)

    act(() => { queryClient.setQueryData(feedKey(USER), { pages: [], pageParams: [] }) })
    expect(view.result.current).toBe(false) // idle is still pending
    act(() => { vi.advanceTimersByTime(1500) })
    expect(view.result.current).toBe(true)
  })

  it('does not wait for the feed when the screen is not the feed', () => {
    const { view } = setup({ waitForFeed: false })
    expect(view.result.current).toBe(false)
    act(() => { vi.advanceTimersByTime(1500) })
    expect(view.result.current).toBe(true)
  })

  it('turns true after the fallback even if the feed never settles', () => {
    const { view } = setup({ waitForFeed: true })
    act(() => { vi.advanceTimersByTime(3900) })
    expect(view.result.current).toBe(false)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(view.result.current).toBe(true)
  })

  it('stays false without a user', () => {
    const queryClient = new QueryClient()
    const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useDeferredStart(null, { waitForFeed: false }), { wrapper })
    act(() => { vi.advanceTimersByTime(10000) })
    expect(result.current).toBe(false)
  })
})
