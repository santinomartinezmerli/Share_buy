import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { usePullToRefresh } from './usePullToRefresh'

const touch = (type, y) => {
  const event = new Event(type, { bubbles: true })
  event.touches = [{ clientY: y }]
  document.dispatchEvent(event)
}
const pull = () => {
  touch('touchstart', 100)
  touch('touchmove', 200)
}

describe('usePullToRefresh enabled flag', () => {
  afterEach(cleanup)

  it('starts pulling from a downward swipe when enabled (the default)', () => {
    const { result } = renderHook(() => usePullToRefresh(() => {}))
    act(() => pull())
    expect(result.current.pulling).toBe(true)
  })

  it('ignores touches while disabled, whatever order the events come in', () => {
    const { result } = renderHook(() => usePullToRefresh(() => {}, { enabled: false }))
    act(() => pull())
    expect(result.current.pulling).toBe(false)
    expect(result.current.pullDistance).toBe(0)
  })

  it('works again once it is enabled', () => {
    const { result, rerender } = renderHook(({ enabled }) => usePullToRefresh(() => {}, { enabled }), { initialProps: { enabled: false } })
    act(() => pull())
    expect(result.current.pulling).toBe(false)
    act(() => touch('touchend', 200))
    rerender({ enabled: true })
    act(() => pull())
    expect(result.current.pulling).toBe(true)
  })
})
