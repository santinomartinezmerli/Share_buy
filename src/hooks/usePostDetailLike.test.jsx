import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { feedKey } from '../lib/feedCache'
import { usePostDetailLike } from './usePostDetailLike'

vi.mock('../services/engagement', () => ({
  addLike: vi.fn(),
  removeLike: vi.fn(),
}))
import { addLike, removeLike } from '../services/engagement'

const USER = 'user-1'
const POST = 'post-1'
const feedData = () => ({ pages: [{ posts: [{ id: POST, liked_by_me: false, like_count: 4 }] }], pageParams: [null] })
const exploreData = () => ({ pages: [{ posts: [{ id: POST, liked_by_me: false }] }], pageParams: [null] })

function setup() {
  const queryClient = new QueryClient()
  queryClient.setQueryData(feedKey(USER), feedData())
  queryClient.setQueryData(['explore', USER, {}], exploreData())
  const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const view = renderHook(() => usePostDetailLike(POST, USER), { wrapper })
  act(() => view.result.current.init(false, 4))
  const feedPost = () => queryClient.getQueryData(feedKey(USER)).pages[0].posts[0]
  const explorePost = () => queryClient.getQueryData(['explore', USER, {}]).pages[0].posts[0]
  return { queryClient, view, feedPost, explorePost }
}

describe('usePostDetailLike', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('likes: updates the screen and the feed and Explore caches, and calls addLike', async () => {
    addLike.mockResolvedValue()
    const { view, feedPost, explorePost, queryClient } = setup()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    await act(() => view.result.current.toggleLike())

    expect(addLike).toHaveBeenCalledWith(POST, USER)
    expect(view.result.current).toMatchObject({ liked: true, likesCount: 5 })
    expect(feedPost()).toMatchObject({ liked_by_me: true, like_count: 5 })
    expect(explorePost().liked_by_me).toBe(true)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['feed'] })
  })

  it('unlikes when it was already liked', async () => {
    addLike.mockResolvedValue()
    removeLike.mockResolvedValue()
    const { view, feedPost } = setup()
    await act(() => view.result.current.toggleLike())
    await act(() => view.result.current.toggleLike())

    expect(removeLike).toHaveBeenCalledWith(POST, USER)
    expect(view.result.current).toMatchObject({ liked: false, likesCount: 4 })
    expect(feedPost()).toMatchObject({ liked_by_me: false, like_count: 4 })
  })

  it('rolls everything back when the request fails', async () => {
    addLike.mockRejectedValue(new Error('network'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { view, feedPost, explorePost } = setup()

    await act(() => view.result.current.toggleLike())

    expect(view.result.current).toMatchObject({ liked: false, likesCount: 4 })
    expect(feedPost()).toMatchObject({ liked_by_me: false, like_count: 4 })
    expect(explorePost().liked_by_me).toBe(false)
  })

  it('ignores a second tap while the first request is in flight', async () => {
    let resolve
    addLike.mockReturnValue(new Promise((r) => { resolve = r }))
    const { view } = setup()

    let first
    act(() => { first = view.result.current.toggleLike() })
    await act(() => view.result.current.toggleLike())
    await act(async () => { resolve(); await first })

    expect(addLike).toHaveBeenCalledTimes(1)
    expect(removeLike).not.toHaveBeenCalled()
  })

  it('likeOnly (double tap) never removes a like', async () => {
    addLike.mockResolvedValue()
    const { view } = setup()
    await act(() => view.result.current.likeOnly())
    await act(() => view.result.current.likeOnly())

    expect(addLike).toHaveBeenCalledTimes(1)
    expect(removeLike).not.toHaveBeenCalled()
    expect(view.result.current.liked).toBe(true)
  })

  it('does nothing without a signed-in user', async () => {
    const queryClient = new QueryClient()
    const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    const { result } = renderHook(() => usePostDetailLike(POST, null), { wrapper })
    await act(() => result.current.toggleLike())
    expect(addLike).not.toHaveBeenCalled()
  })
})
