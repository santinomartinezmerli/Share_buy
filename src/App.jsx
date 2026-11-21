import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useUser } from './lib/UserContext.jsx'
import { DarkModeProvider } from './lib/DarkModeContext'
import Feed from './pages/Feed'
import Layout from './components/Layout'
import { supabase } from './lib/supabase'
import ErrorBoundary from './components/ErrorBoundary'

// Every screen except Feed (the first thing a signed-in user sees) is its own chunk, downloaded
// the first time it is opened. Landing is only for signed-out users, so it is lazy too.
const Landing = lazy(() => import('./pages/Landing'))
const SetupProfile = lazy(() => import('./pages/SetupProfile'))
const Explore = lazy(() => import('./pages/Explore'))
const NewPost = lazy(() => import('./pages/NewPost'))
const PostDetail = lazy(() => import('./pages/PostDetail'))
const Profile = lazy(() => import('./pages/Profile'))
const EditProfile = lazy(() => import('./pages/EditProfile'))
const UserProfile = lazy(() => import('./pages/UserProfile'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Review = lazy(() => import('./pages/Review'))
const Messages = lazy(() => import('./pages/Messages'))
const Chat = lazy(() => import('./pages/Chat'))
const FollowList = lazy(() => import('./pages/FollowList'))
const EditPost = lazy(() => import('./pages/EditPost'))
const Settings = lazy(() => import('./pages/Settings'))

// Same screen as the session check below, so going from "Cargando..." to the lazy Landing does not flicker.
function FullScreenLoading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-green-500 text-sm">Cargando...</div>
    </div>
  )
}

function RouteFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="text-green-500 text-sm">Cargando...</div>
    </div>
  )
}

// Error boundary of the current screen: it sits inside Layout so the nav bar survives a crash, and
// it resets when the route changes.
function RouteBoundary({ children }) {
  const { pathname } = useLocation()
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
}

function App() {
  const { session, loading, user, userId } = useUser()
  const userEmail = user?.email
  const [needsSetup, setNeedsSetup] = useState(false)

  // Runs once per user (not on every token refresh): one query to know if the profile
  // exists and is complete; if it does not exist yet, create it.
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const checkProfile = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('setup_complete')
        .eq('id', userId)
        .maybeSingle()
      if (cancelled) return

      if (!profile) {
        // ignoreDuplicates = ON CONFLICT DO NOTHING: safe if two checks race.
        await supabase.from('profiles').upsert(
          { id: userId, username: userEmail?.split('@')[0] ?? 'usuario', setup_complete: false },
          { onConflict: 'id', ignoreDuplicates: true }
        )
        if (cancelled) return
        setNeedsSetup(true)
      } else {
        setNeedsSetup(!profile.setup_complete)
      }
    }

    checkProfile()
    return () => { cancelled = true }
  }, [userId, userEmail])

  if (loading) return <FullScreenLoading />

  if (!session) return (
    <Suspense fallback={<FullScreenLoading />}>
      <Landing />
    </Suspense>
  )

  return (
    <BrowserRouter>
      <DarkModeProvider>
        {needsSetup ? (
          <RouteBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="*" element={<SetupProfile />} />
              </Routes>
            </Suspense>
          </RouteBoundary>
        ) : (
          <Layout>
            <RouteBoundary>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/feed" />} />
                  <Route path="/feed" element={<Feed />} />
                  <Route path="/explore" element={<Explore />} />
                  <Route path="/new" element={<NewPost />} />
                  <Route path="/post/:postId" element={<PostDetail />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/review/:postId" element={<Review />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/edit-profile" element={<EditProfile />} />
                  <Route path="/user/:userId" element={<UserProfile />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/messages/:conversationId" element={<Chat />} />
                  <Route path="/user/:userId/follow" element={<FollowList />} />
                  <Route path="/edit-post/:postId" element={<EditPost />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Suspense>
            </RouteBoundary>
          </Layout>
        )}
      </DarkModeProvider>
    </BrowserRouter>
  )
}

export default App
