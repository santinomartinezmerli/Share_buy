import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { lockOverlay, useOverlayOpen } from './overlayLock'

describe('overlayLock', () => {
  it('is open while any lock is held and closes when the last one is released', () => {
    const { result } = renderHook(() => useOverlayOpen())
    expect(result.current).toBe(false)
    let a, b
    act(() => { a = lockOverlay(); b = lockOverlay() })
    expect(result.current).toBe(true)
    act(() => a())
    expect(result.current).toBe(true)
    act(() => b())
    expect(result.current).toBe(false)
  })

  it('releasing the same lock twice does not unlock another one', () => {
    const { result } = renderHook(() => useOverlayOpen())
    let a, b
    act(() => { a = lockOverlay(); b = lockOverlay() })
    act(() => { a(); a() })
    expect(result.current).toBe(true)
    act(() => b())
    expect(result.current).toBe(false)
  })
})
