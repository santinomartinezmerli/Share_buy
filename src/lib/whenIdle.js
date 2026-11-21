// Runs `callback` when the browser is idle (requestIdleCallback), or shortly after where that API
// does not exist (Safari). Returns a function that cancels it.
export function whenIdle(callback, { timeout = 1500, fallbackDelay = 200 } = {}) {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(callback, { timeout })
    return () => cancelIdleCallback(id)
  }
  const id = setTimeout(callback, fallbackDelay)
  return () => clearTimeout(id)
}
