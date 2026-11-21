import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../lib/UserContext.jsx'
import { useNotifications, useReviewReminders, useMarkNotificationsRead } from '../hooks/useNotifications'
import EmptyState from '../components/EmptyState'
import { SkeletonList } from '../components/Skeleton'
import { motion } from 'framer-motion'

const REMINDERS_SHOWN = 3

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

// Icon circle, icon path and action text of each notification type. Likes and comments open
// the post, follows open the profile of whoever followed.
const TYPES = {
  follow: {
    circle: 'bg-blue-100 dark:bg-blue-900/30',
    icon: 'text-blue-500',
    path: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
    text: 'empezó a seguirte',
  },
  like: {
    circle: 'bg-red-100 dark:bg-red-900/30',
    icon: 'text-red-500',
    path: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    text: 'le dio like a tu publicación',
  },
  comment: {
    circle: 'bg-green-100 dark:bg-green-900/30',
    icon: 'text-green-600',
    path: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    text: 'comentó tu publicación',
  },
}

function NotificationRow({ notif, onOpenPost, onOpenProfile }) {
  const config = TYPES[notif.type]
  if (!config) return null
  const actorName = notif.actor?.username ?? 'alguien'
  const open = () => (notif.type === 'follow' ? onOpenProfile(notif.actor?.id) : onOpenPost(notif.post_id))
  return (
    <motion.div
      role="button"
      tabIndex={0}
      whileTap={{ scale: 0.98 }}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter') open() }}
      className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 w-full ${
        notif.read_at ? '' : 'bg-green-50/60 dark:bg-green-900/10'
      }`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${config.circle}`}>
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${config.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={config.path} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 dark:text-gray-100">
          <span
            role="link"
            onClick={(e) => { e.stopPropagation(); onOpenProfile(notif.actor?.id) }}
            className="font-medium hover:underline"
          >
            {actorName}
          </span>{' '}
          {config.text}
          {notif.type !== 'follow' && notif.post?.product && (
            <span className="text-gray-500 dark:text-gray-400"> · {notif.post.product}</span>
          )}
        </p>
        {notif.type === 'comment' && notif.preview && (
          <p className="text-xs text-gray-400 dark:text-gray-300 truncate mt-0.5">{notif.preview}</p>
        )}
      </div>
      <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(notif.created_at)}</span>
    </motion.div>
  )
}

function ReviewReminder({ reminder, onWrite }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-purple-50 dark:bg-purple-900/20">
      <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-900 dark:text-gray-100">
          <span className="font-medium">Ya pasaron {reminder.days_since} días</span> desde que compraste{' '}
          <span className="font-medium">{reminder.product}</span>. ¿Qué te pareció?
        </p>
        <button onClick={() => onWrite(reminder.id)}
          className="mt-2 text-xs font-medium text-purple-500 border border-purple-200 dark:border-purple-700 rounded-full px-3 py-1">
          Escribir review
        </button>
      </div>
    </div>
  )
}

function Notifications() {
  const navigate = useNavigate()
  const { userId } = useUser()
  const sentinelRef = useRef(null)
  const [showAllReminders, setShowAllReminders] = useState(false)

  const { notifications, loading, loadingMore, hasMore, loadMore } = useNotifications(userId)
  const reminders = useReviewReminders(userId)

  const unreadShown = notifications.filter((n) => !n.read_at).length
  useMarkNotificationsRead(userId, unreadShown)

  // Infinite scroll: same observer as the feed.
  useEffect(() => {
    if (!sentinelRef.current) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMore()
      }
    }, { threshold: 0.1 })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [loadMore, hasMore, loadingMore])

  const openPost = (postId) => { if (postId) navigate(`/post/${postId}`) }
  const openProfile = (profileId) => { if (profileId) navigate(`/user/${profileId}`) }
  const writeReview = (postId) => navigate(`/review/${postId}`)

  if (loading) return <SkeletonList count={6} />

  const visibleReminders = showAllReminders ? reminders : reminders.slice(0, REMINDERS_SHOWN)
  const hiddenReminders = reminders.length - visibleReminders.length

  return (
    <div className="flex flex-col dark:bg-gray-900 dark:text-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h1 className="text-base font-semibold text-gray-900 dark:text-white">Notificaciones</h1>
      </div>

      {visibleReminders.map(reminder => (
        <ReviewReminder key={reminder.id} reminder={reminder} onWrite={writeReview} />
      ))}
      {hiddenReminders > 0 && (
        <button
          onClick={() => setShowAllReminders(true)}
          className="px-4 py-2.5 text-xs font-medium text-purple-500 text-left border-b border-gray-100 dark:border-gray-800"
        >
          Ver más recordatorios ({hiddenReminders})
        </button>
      )}

      {notifications.length === 0 ? (
        <EmptyState
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.437L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          }
          title="Sin notificaciones por ahora"
          subtitle="Cuando alguien te siga o comente tus publicaciones, lo vas a ver acá"
        />
      ) : (
        <div className="flex flex-col">
          {notifications.map(notif => (
            <NotificationRow key={notif.id} notif={notif} onOpenPost={openPost} onOpenProfile={openProfile} />
          ))}
          <div ref={sentinelRef} className="h-1" />
          {loadingMore && <SkeletonList count={2} />}
        </div>
      )}
    </div>
  )
}

export default Notifications
