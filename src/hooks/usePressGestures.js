import { useCallback, useEffect, useRef } from 'react'

// A press that lasts this long is a "hold" (pause), not a tap.
export const HOLD_MS = 200
// Moving more than this many pixels while pressed is a drag (swipe), not a tap.
const MOVE_PX = 10

// Tells a short tap from press-and-hold for the story viewer. The whole gesture is decided when the
// finger lifts (there is no onClick), so releasing after a hold can never also count as a tap:
//   - onPress fires on pointer down (pause) and onRelease when it ends, whatever the way (resume).
//   - onTap(zone) fires only if the press was shorter than HOLD_MS, did not move and was not
//     cancelled. zone is 'left' for the first third of the element and 'right' for the rest.
// The up/move/cancel listeners are on window, so the release is seen even outside the element.
export function usePressGestures({ onPress, onRelease, onTap }) {
  const callbacks = useRef({ onPress, onRelease, onTap })
  useEffect(() => { callbacks.current = { onPress, onRelease, onTap } })
  const stopListening = useRef(null)

  const onPointerDown = useCallback((e) => {
    if (e.button > 0) return // only the primary button / touch / pen contact
    stopListening.current?.()
    const startedAt = Date.now()
    const x0 = e.clientX
    const y0 = e.clientY
    const rect = e.currentTarget.getBoundingClientRect()
    let moved = false
    callbacks.current.onPress?.()

    const onMove = (ev) => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > MOVE_PX) moved = true
    }
    const finish = (ev, cancelled) => {
      stopListening.current?.()
      callbacks.current.onRelease?.()
      if (cancelled || moved || Date.now() - startedAt >= HOLD_MS) return
      const zone = rect.width > 0 && (ev.clientX - rect.left) / rect.width < 1 / 3 ? 'left' : 'right'
      callbacks.current.onTap?.(zone)
    }
    const onUp = (ev) => finish(ev, false)
    const onCancel = (ev) => finish(ev, true)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    stopListening.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      stopListening.current = null
    }
  }, [])

  useEffect(() => () => stopListening.current?.(), [])

  return { onPointerDown }
}
