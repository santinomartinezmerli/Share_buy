import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, waitFor, act } from '@testing-library/react'
import { StrictMode, useEffect } from 'react'
import { useOverlayHistory } from './useOverlayHistory'

let api
const setApi = (value) => { api = value }
function Overlay({ onClose }) {
  const value = useOverlayHistory(onClose)
  useEffect(() => { setApi(value) })
  return null
}

const entryOpen = () => !!window.history.state?.overlayEntry
const settle = () => waitFor(() => expect(entryOpen()).toBe(false))

describe('useOverlayHistory', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('opening adds exactly one entry and closing it leaves the history as it was', async () => {
    const lengthBefore = window.history.length
    const view = render(<Overlay onClose={() => {}} />)
    expect(entryOpen()).toBe(true)
    expect(window.history.length).toBe(lengthBefore + 1)
    view.unmount()
    await settle()
  })

  it('open and close 3 times: the history length does not keep growing', async () => {
    const lengths = []
    for (let i = 0; i < 3; i++) {
      const view = render(<Overlay onClose={() => {}} />)
      view.unmount()
      await settle()
      lengths.push(window.history.length)
    }
    // The entry of each cycle replaces the one popped by the previous cycle.
    expect(lengths[1]).toBe(lengths[0])
    expect(lengths[2]).toBe(lengths[0])
  })

  it('the Back button closes the overlay and nothing is popped again afterwards', async () => {
    const onClose = vi.fn()
    const view = render(<Overlay onClose={onClose} />)
    window.history.back()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    const back = vi.spyOn(window.history, 'back')
    view.unmount()
    await new Promise((r) => setTimeout(r, 20))
    expect(back).not.toHaveBeenCalled() // the entry was already gone
  })

  it('does not call history.back() when the overlay entry is no longer the current one', async () => {
    const view = render(<Overlay onClose={() => {}} />)
    window.history.replaceState(null, '') // e.g. the app navigated elsewhere
    const back = vi.spyOn(window.history, 'back')
    view.unmount()
    await new Promise((r) => setTimeout(r, 20))
    expect(back).not.toHaveBeenCalled()
  })

  it('survives StrictMode (mount, unmount, mount): one entry, still open', async () => {
    const lengthBefore = window.history.length
    const onClose = vi.fn()
    const view = render(<StrictMode><Overlay onClose={onClose} /></StrictMode>)
    await new Promise((r) => setTimeout(r, 20))
    expect(entryOpen()).toBe(true)
    expect(window.history.length).toBe(lengthBefore + 1)
    expect(onClose).not.toHaveBeenCalled()
    view.unmount()
    await settle()
  })

  it('leaveThen pops the overlay entry first and then runs the action', async () => {
    render(<Overlay onClose={() => {}} />)
    const action = vi.fn()
    act(() => api.leaveThen(action))
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(entryOpen()).toBe(false)
  })

  it('leaveThen runs the action at once if the entry is already gone', () => {
    render(<Overlay onClose={() => {}} />)
    window.history.replaceState(null, '')
    const action = vi.fn()
    api.leaveThen(action)
    expect(action).toHaveBeenCalledTimes(1)
  })
})
