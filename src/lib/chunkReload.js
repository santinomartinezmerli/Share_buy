// After a deploy, a tab that was already open still runs the old JS and asks for chunk files
// (hashed names) that no longer exist. The fix is to reload once and get the new index.html.
//
// The guard lives in sessionStorage with a timestamp so a chunk that stays broken (a real outage)
// reloads once and then shows the error screen instead of looping. A later deploy in the same
// session, more than RELOAD_WINDOW_MS afterwards, can reload again.
const GUARD_KEY = 'chunk-reload-at'
const RELOAD_WINDOW_MS = 30_000

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i, // Chrome, Edge
  /error loading dynamically imported module/i, // Firefox
  /Importing a module script failed/i, // Safari
  /Unable to preload CSS/i, // Vite, when a lazy chunk's CSS is missing
  /Loading chunk [\w-]+ failed/i,
]

export function isChunkLoadError(error) {
  const message = String(error?.message ?? error ?? '')
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

// Reloads the page unless it already did so a moment ago. Returns true if it reloaded.
export function reloadOnceForNewDeploy() {
  try {
    const last = Number(sessionStorage.getItem(GUARD_KEY) ?? 0)
    if (Date.now() - last < RELOAD_WINDOW_MS) return false
    sessionStorage.setItem(GUARD_KEY, String(Date.now()))
  } catch {
    // sessionStorage unavailable (private mode): do not risk a reload loop.
    return false
  }
  window.location.reload()
  return true
}

// Vite fires this event when a dynamic import (or its CSS) fails to load.
export function listenForPreloadErrors() {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnceForNewDeploy()) event.preventDefault()
  })
}
