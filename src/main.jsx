import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { UserProvider } from './lib/UserContext.jsx'
import { queryClient } from './lib/queryClient'
import ErrorBoundary from './components/ErrorBoundary'
import { listenForPreloadErrors } from './lib/chunkReload'

listenForPreloadErrors()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary fullScreen>
      <QueryClientProvider client={queryClient}>
        <UserProvider>
          <App />
        </UserProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
