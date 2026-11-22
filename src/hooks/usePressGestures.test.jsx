import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { usePressGestures, HOLD_MS } from './usePressGestures'

function Area({ handlers }) {
  const gestures = usePressGestures(handlers)
  return <div data-testid="area" {...gestures} />
}

function setup() {
  const handlers = { onPress: vi.fn(), onRelease: vi.fn(), onTap: vi.fn() }
  const { getByTestId } = render(<Area handlers={handlers} />)
  const area = getByTestId('area')
  // jsdom has no layout: the element is 300 px wide, starting at x = 0.
  area.getBoundingClientRect = () => ({ left: 0, width: 300, top: 0, height: 600 })
  return { area, handlers }
}

const down = (area, x = 200, y = 100) => fireEvent.pointerDown(area, { clientX: x, clientY: y, button: 0 })
const up = (x = 200, y = 100) => fireEvent.pointerUp(window, { clientX: x, clientY: y })

describe('usePressGestures', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); cleanup() })

  it('a short tap pauses, resumes and reports one tap', () => {
    const { area, handlers } = setup()
    down(area)
    expect(handlers.onPress).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(80)
    up()
    expect(handlers.onRelease).toHaveBeenCalledTimes(1)
    expect(handlers.onTap).toHaveBeenCalledTimes(1)
  })

  it('press and hold: releasing resumes but does NOT count as a tap', () => {
    const { area, handlers } = setup()
    down(area)
    vi.advanceTimersByTime(HOLD_MS + 50)
    up()
    expect(handlers.onRelease).toHaveBeenCalledTimes(1)
    expect(handlers.onTap).not.toHaveBeenCalled()
  })

  it('a press just under the hold time is still a tap', () => {
    const { area, handlers } = setup()
    down(area)
    vi.advanceTimersByTime(HOLD_MS - 1)
    up()
    expect(handlers.onTap).toHaveBeenCalledTimes(1)
  })

  it('the left third is "left", the rest is "right"', () => {
    const { area, handlers } = setup()
    down(area, 50); up(50)
    down(area, 99); up(99)
    down(area, 100); up(100)
    down(area, 280); up(280)
    expect(handlers.onTap.mock.calls.map(([zone]) => zone)).toEqual(['left', 'left', 'right', 'right'])
  })

  it('a drag is not a tap', () => {
    const { area, handlers } = setup()
    down(area, 200, 100)
    fireEvent.pointerMove(window, { clientX: 200, clientY: 180 })
    vi.advanceTimersByTime(50)
    up(200, 180)
    expect(handlers.onRelease).toHaveBeenCalledTimes(1)
    expect(handlers.onTap).not.toHaveBeenCalled()
  })

  it('a cancelled press resumes without a tap', () => {
    const { area, handlers } = setup()
    down(area)
    fireEvent.pointerCancel(window)
    expect(handlers.onRelease).toHaveBeenCalledTimes(1)
    expect(handlers.onTap).not.toHaveBeenCalled()
  })

  it('ignores the right mouse button', () => {
    const { area, handlers } = setup()
    fireEvent.pointerDown(area, { clientX: 10, clientY: 10, button: 2 })
    expect(handlers.onPress).not.toHaveBeenCalled()
  })

  it('stops listening after the release', () => {
    const { area, handlers } = setup()
    down(area); up()
    up()
    expect(handlers.onRelease).toHaveBeenCalledTimes(1)
  })
})
