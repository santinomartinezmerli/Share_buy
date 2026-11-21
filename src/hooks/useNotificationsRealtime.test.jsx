import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { notificationsKey, unreadNotificationsKey } from '../lib/notificationsCache'

// A fake Realtime channel that records the handlers so the test can fire events by hand.
const handlers = {}
const channelMock = {
  on: vi.fn((type, filter, cb) => { handlers[filter.event] = { filter, cb }; return channelMock }),
  subscribe: vi.fn(() => channelMock),
}
const supabaseMock = {
  channel: vi.fn(() => channelMock),
  removeChannel: vi.fn(),
}
vi.mock('../lib/supabase', () => ({ supabase: supabaseMock }))

const { useNotificationsRealtime } = await import('./useNotificationsRealtime')

const USER = 'user-1'

function setup(enabled = true) {
  const queryClient = new QueryClient()
  queryClient.setQueryData(notificationsKey(USER), {
    pages: [{ notifications: [{ id: 'n1' }, { id: 'n2' }] }],
    pageParams: [null],
  })
  queryClient.setQueryData(unreadNotificationsKey(USER), 2)
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const view = renderHook(({ on }) => useNotificationsRealtime(USER, on), { wrapper, initialProps: { on: enabled } })
  return { invalidate, view }
}

const invalidatedKeys = (spy) => spy.mock.calls.map(([arg]) => arg.queryKey)

describe('useNotificationsRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(handlers)) delete handlers[k]
  })

  it('opens a single channel listening to INSERT (filtered by user) and DELETE', () => {
    setup()
    expect(supabaseMock.channel).toHaveBeenCalledTimes(1)
    expect(handlers.INSERT.filter.filter).toBe(`user_id=eq.${USER}`)
    expect(handlers.DELETE.filter.filter).toBeUndefined()
  })

  it('invalidates the list and the counter when a DELETE is for a loaded notification', () => {
    const { invalidate } = setup()
    handlers.DELETE.cb({ old: { id: 'n2' } })
    expect(invalidatedKeys(invalidate)).toEqual([
      notificationsKey(USER),
      unreadNotificationsKey(USER),
    ])
  })

  it('ignores a DELETE for a notification that is not in the loaded list', () => {
    const { invalidate } = setup()
    handlers.DELETE.cb({ old: { id: 'somebody-elses' } })
    handlers.DELETE.cb({ old: {} })
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('invalidates the list and the counter on INSERT', () => {
    const { invalidate } = setup()
    handlers.INSERT.cb({ new: { id: 'n3' } })
    expect(invalidatedKeys(invalidate)).toEqual([
      notificationsKey(USER),
      unreadNotificationsKey(USER),
    ])
  })

  it('opens no channel while disabled, and exactly one notifications channel once enabled', () => {
    const { view } = setup(false)
    expect(supabaseMock.channel).not.toHaveBeenCalled()

    view.rerender({ on: true })
    expect(supabaseMock.channel).toHaveBeenCalledTimes(1)
    expect(supabaseMock.channel).toHaveBeenCalledWith(`notifications:${USER}`)

    view.rerender({ on: true }) // re-rendering does not open a second one
    expect(supabaseMock.channel).toHaveBeenCalledTimes(1)
  })

  it('removes the channel synchronously on unmount', () => {
    const { view } = setup()
    view.unmount()
    expect(supabaseMock.removeChannel).toHaveBeenCalledWith(channelMock)
  })
})
