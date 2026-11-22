import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import StoryViewer from './StoryViewer'

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
