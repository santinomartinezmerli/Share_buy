import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import StoryViewer, { shouldCloseOnSwipe } from './StoryViewer'
import { useOverlayOpen } from '../lib/overlayLock'

const story = (id) => ({ id, product: `product-${id}`, image_url: `https://img/${id}.webp` })
const groups = [
  { userId: 'a', username: 'ana', stories: [story('a1'), story('a2')] },
  { userId: 'b', username: 'beto', stories: [story('b1')] },
]

function setup(activeGroupIndex = 0) {
  const props = { storyGroups: groups, activeGroupIndex, onClose: vi.fn(), onNextGroup: vi.fn(), onPrevGroup: vi.fn() }
  const view = render(<MemoryRouter><StoryViewer {...props} /></MemoryRouter>)
  const area = view.getByTestId('story-area')
  area.getBoundingClientRect = () => ({ left: 0, width: 300, top: 0, height: 600 })
  const tap = (x) => {
    fireEvent.pointerDown(area, { clientX: x, clientY: 100, button: 0 })
    act(() => { vi.advanceTimersByTime(60) })
    fireEvent.pointerUp(window, { clientX: x, clientY: 100 })
  }
  return { ...view, props, tap }
}

describe('StoryViewer tap zones', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); cleanup() })

  it('a tap on the right two thirds goes to the next story', () => {
    const { tap, getByText } = setup()
    expect(getByText('product-a1')).toBeTruthy()
    tap(250)
    expect(getByText('product-a2')).toBeTruthy()
  })

  it('a tap on the left third goes back to the previous story', () => {
    const { tap, getByText } = setup()
    tap(250)
    expect(getByText('product-a2')).toBeTruthy()
    tap(40)
    expect(getByText('product-a1')).toBeTruthy()
  })

  it('a tap on the left third of the first story restarts it, without leaving the group', () => {
    const { tap, getByText, props } = setup()
    tap(40)
    expect(getByText('product-a1')).toBeTruthy()
    expect(props.onNextGroup).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('a tap on the right of the last story of a group asks for the next group', () => {
    const { tap, props } = setup()
    tap(250)
    tap(250)
    expect(props.onNextGroup).toHaveBeenCalledTimes(1)
  })

  it('press and hold on the right side does not advance when released', () => {
    const { getByTestId, getByText, props } = setup()
    const area = getByTestId('story-area')
    fireEvent.pointerDown(area, { clientX: 250, clientY: 100, button: 0 })
    act(() => { vi.advanceTimersByTime(600) })
    fireEvent.pointerUp(window, { clientX: 250, clientY: 100 })
    expect(getByText('product-a1')).toBeTruthy()
    expect(props.onNextGroup).not.toHaveBeenCalled()
  })

  it('does not advance by itself while the press is held', () => {
    const { getByTestId, getByText } = setup()
    fireEvent.pointerDown(getByTestId('story-area'), { clientX: 250, clientY: 100, button: 0 })
    act(() => { vi.advanceTimersByTime(8000) })
    expect(getByText('product-a1')).toBeTruthy()
  })
})

describe('StoryViewer progress bar', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); cleanup() })

  // The bar of the current story is the first one that is not full.
  const bars = (container) => [...container.querySelectorAll('.origin-left')]
  const scale = (bar) => Number(/scaleX\(([\d.]+)\)/.exec(bar.style.transform)[1])

  it('fills smoothly (many small steps, not jumps of 2 %)', () => {
    const { container } = setup()
    const seen = new Set()
    for (let i = 0; i < 100; i++) {
      act(() => { vi.advanceTimersByTime(16) })
      seen.add(scale(bars(container)[0]))
    }
    expect(seen.size).toBeGreaterThan(50)
    const ratio = scale(bars(container)[0])
    expect(ratio).toBeGreaterThan(0.25)
    expect(ratio).toBeLessThan(0.4) // about 1.6 s of 5 s
  })

  it('moves to the next story when the bar is full', () => {
    const { getByText } = setup()
    act(() => { vi.advanceTimersByTime(5200) })
    expect(getByText('product-a2')).toBeTruthy()
  })

  it('stops while pressed and continues from the same point', () => {
    const { container, getByTestId } = setup()
    act(() => { vi.advanceTimersByTime(2000) })
    const before = scale(bars(container)[0])
    fireEvent.pointerDown(getByTestId('story-area'), { clientX: 250, clientY: 100, button: 0 })
    act(() => { vi.advanceTimersByTime(3000) })
    expect(scale(bars(container)[0])).toBeCloseTo(before, 5)
    fireEvent.pointerUp(window, { clientX: 250, clientY: 100 })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(scale(bars(container)[0])).toBeGreaterThan(before + 0.15)
  })

  it('a new group starts on its first story even if the old index is past its end', () => {
    const three = { userId: 'c', username: 'cleo', stories: [story('c1'), story('c2'), story('c3')] }
    const props = { activeGroupIndex: 0, onClose: vi.fn(), onNextGroup: vi.fn(), onPrevGroup: vi.fn() }
    const { rerender, getByText } = render(<MemoryRouter><StoryViewer {...props} storyGroups={[three, groups[1]]} /></MemoryRouter>)
    act(() => { vi.advanceTimersByTime(5200) }) // c1 -> c2 (state updates are batched per act)
    act(() => { vi.advanceTimersByTime(5200) }) // c2 -> c3
    expect(getByText('product-c3')).toBeTruthy()
    rerender(<MemoryRouter><StoryViewer {...props} storyGroups={[three, groups[1]]} activeGroupIndex={1} /></MemoryRouter>)
    expect(getByText('product-b1')).toBeTruthy()
  })
})

describe('StoryViewer swipe down to close', () => {
  it('closes past the distance or at speed, and stays open for a short slow drag', () => {
    expect(shouldCloseOnSwipe(150, 0)).toBe(true)
    expect(shouldCloseOnSwipe(30, 900)).toBe(true)
    expect(shouldCloseOnSwipe(60, 100)).toBe(false)
    expect(shouldCloseOnSwipe(-200, -900)).toBe(false) // upwards never closes
  })
})

describe('StoryViewer and pull-to-refresh', () => {
  afterEach(cleanup)

  it('marks an overlay as open while mounted and releases it on unmount', () => {
    let seen
    const Probe = () => { seen = useOverlayOpen(); return null }
    const props = { storyGroups: groups, activeGroupIndex: 0, onClose: vi.fn(), onNextGroup: vi.fn() }
    const view = render(<MemoryRouter><Probe /><StoryViewer {...props} /></MemoryRouter>)
    expect(seen).toBe(true)
    view.rerender(<MemoryRouter><Probe /></MemoryRouter>)
    expect(seen).toBe(false)
  })
})
