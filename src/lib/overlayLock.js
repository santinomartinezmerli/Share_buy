import { useSyncExternalStore } from 'react'

// A tiny counter for full-screen overlays (the story viewer). While at least one is open, other parts
// of the app can step aside, e.g. pull-to-refresh must not start from a swipe inside the overlay.
// It is a counter, not a boolean, so two overlays (or React StrictMode mounting twice) cannot unlock each other.
let openCount = 0
const listeners = new Set()
const emit = () => listeners.forEach((listener) => listener())

// Returns the function that releases this lock (safe to call more than once).
export function lockOverlay() {
  openCount += 1
  emit()
  let released = false
  return () => {
    if (released) return
    released = true
    openCount -= 1
    emit()
  }
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useOverlayOpen() {
  return useSyncExternalStore(subscribe, () => openCount > 0, () => false)
}
