import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isChunkLoadError, reloadOnceForNewDeploy } from './chunkReload'

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x/assets/Chat-abc.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
  ])('detects "%s"', (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true)
  })

  it('ignores ordinary errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
  })
})

describe('reloadOnceForNewDeploy', () => {
  const reload = vi.fn()
  beforeEach(() => {
    sessionStorage.clear()
    reload.mockClear()
    Object.defineProperty(window, 'location', { value: { reload }, configurable: true })
  })

  it('reloads the first time and not again right after (no reload loop)', () => {
    expect(reloadOnceForNewDeploy()).toBe(true)
    expect(reloadOnceForNewDeploy()).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
