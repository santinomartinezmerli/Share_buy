import { createContext, useContext, useEffect, useState } from 'react'

const DarkModeContext = createContext()

const THEME_KEY = 'theme'
const MODES = ['light', 'dark', 'system']

// The preference is 'light' | 'dark' | 'system'. Before the selector existed the app saved a
// 'dark' = 'true' | 'false' flag: it is read once so nobody's choice is lost. With no saved
// value at all (a new user) the app follows the system.
function readStoredMode() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (MODES.includes(stored)) return stored
    const legacy = localStorage.getItem('dark')
    if (legacy === 'true') return 'dark'
    if (legacy === 'false') return 'light'
  } catch { /* storage unavailable: use the default */ }
  return 'system'
}

const systemQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)') ?? null

export function DarkModeProvider({ children }) {
  const [mode, setMode] = useState(readStoredMode)
  const [systemDark, setSystemDark] = useState(() => !!systemQuery()?.matches)

  // Follow the system while the mode is 'system'.
  useEffect(() => {
    const query = systemQuery()
    if (!query) return
    const onChange = (e) => setSystemDark(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const dark = mode === 'dark' || (mode === 'system' && systemDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const changeMode = (next) => {
    if (!MODES.includes(next)) return
    setMode(next)
    try { localStorage.setItem(THEME_KEY, next) } catch { /* not saved: still applied now */ }
  }

  return (
    <DarkModeContext.Provider value={{ mode, setMode: changeMode, dark }}>
      {children}
    </DarkModeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- provider and hook share one context; splitting files is out of scope
export function useDarkMode() {
  return useContext(DarkModeContext)
}
