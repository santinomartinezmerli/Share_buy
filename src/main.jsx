import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { UserProvider } from './lib/UserContext.jsx'
import { queryClient } from './lib/queryClient'
import ErrorBoundary from './components/ErrorBoundary'
import { listenForPreloadErrors } from './lib/chunkReload'
import { prefetchFeed } from './lib/prefetchFeed'

listenForPreloadErrors()
// Start the feed request now, in parallel with React mounting (see lib/prefetchFeed.js).
prefetchFeed(queryClient)

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
