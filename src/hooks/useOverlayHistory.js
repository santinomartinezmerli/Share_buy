import { useCallback, useEffect, useRef } from 'react'

const MARK = 'overlayEntry'

// How many overlays are mounted right now. Used so React StrictMode (which unmounts and mounts a
// component straight away in development) does not pop the history entry it is about to reuse.
let mounted = 0

const hasEntry = () => !!window.history.state?.[MARK]

// Gives a full-screen overlay (the story viewer) its own history entry, so the browser Back button
// closes the overlay instead of leaving the screen underneath it.
//
//  - Opening pushes one entry. It keeps the router's own state (idx, key, usr), so react-router sees
//    the same location and nothing else in the app reacts.
//  - Back (popstate) calls onClose.
//  - Closing any other way (the X, swiping down, the last story) calls history.back(), but ONLY if
//    the overlay's entry is still the current one. If it is already gone (Back was used, or the user
//    navigated somewhere else) nothing is popped, so each open/close cycle leaves the history
//    exactly as it found it and Back never has extra entries to go through.
//
// Returns leaveThen(fn): runs fn once the overlay's entry is out of the way, for actions that
// navigate away (open a profile). Navigating first would leave a stale entry behind.
export function useOverlayHistory(onClose) {
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  useEffect(() => {
    mounted += 1
    if (!hasEntry()) window.history.pushState({ ...window.history.state, [MARK]: true }, '')

    const onPop = () => { if (!hasEntry()) closeRef.current?.() }
    window.addEventListener('popstate', onPop)

    return () => {
      window.removeEventListener('popstate', onPop)
      mounted -= 1
      // Deferred one tick: under StrictMode the overlay is mounted again right away and keeps the entry.
      setTimeout(() => {
        if (mounted === 0 && hasEntry()) window.history.back()
      }, 0)
    }
  }, [])

  const leaveThen = useCallback((fn) => {
    if (!hasEntry()) {
      fn()
      return
    }
    window.addEventListener('popstate', fn, { once: true })
    window.history.back()
  }, [])

  return { leaveThen }
}
