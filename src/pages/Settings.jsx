import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useDarkMode } from '../lib/DarkModeContext'

const THEMES = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
]

function Settings() {
  const navigate = useNavigate()
  const { mode, setMode } = useDarkMode()
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // The react-query cache is cleared by UserProvider when the session ends, so the next account
  // never sees this one's data.
  const handleSignOut = async () => {
    setSigningOut(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out failed:', error)
      setSigningOut(false)
    }
  }

  return (
    <div className="flex flex-col dark:bg-gray-900 dark:text-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <button onClick={() => navigate(-1)} className="text-gray-400" aria-label="Volver">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-900 dark:text-white">Ajustes</span>
      </div>

      <section className="px-4 py-5 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Apariencia</h2>
        <div role="radiogroup" aria-label="Tema" className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
          {THEMES.map(({ value, label }) => (
            <button
              key={value}
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-[background-color,color,box-shadow] ${
                mode === value
                  ? 'bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="px-4 py-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Cuenta</h2>
        {confirmingSignOut ? (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3">
            <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-3">¿Cerrar sesión?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmingSignOut(false)}
                disabled={signingOut}
                className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-60"
              >
                {signingOut ? 'Cerrando...' : 'Cerrar sesión'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingSignOut(true)}
            className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-red-500 active:bg-gray-50 dark:active:bg-gray-800"
          >
            Cerrar sesión
          </button>
        )}
      </section>
    </div>
  )
}

export default Settings
