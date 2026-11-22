import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { usePressGestures } from '../hooks/usePressGestures'
import { useOverlayHistory } from '../hooks/useOverlayHistory'
import { lockOverlay } from '../lib/overlayLock'
import { formatPrice } from '../lib/formatPrice'

// How long each story stays on screen.
const STORY_MS = 5000
// Swiping down closes the viewer past this distance (px) or at this speed (px/s).
const CLOSE_DISTANCE = 120
const CLOSE_VELOCITY = 600

// eslint-disable-next-line react-refresh/only-export-components -- tiny pure helper next to its only user, exported for its test
export const shouldCloseOnSwipe = (offsetY, velocityY) => offsetY > CLOSE_DISTANCE || velocityY > CLOSE_VELOCITY

// The real photo of the user, or their initials if there is none or it fails to load.
function StoryAvatar({ url, username }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-medium shrink-0 overflow-hidden">
      {url && !failed
        ? <img src={url} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
        : username?.slice(0, 2).toUpperCase()}
    </div>
  )
}

function StoryViewer({ storyGroups, activeGroupIndex, onClose, onNextGroup }) {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  // Dragging down moves the content and makes the black background fade, so the feed shows through.
  const dragY = useMotionValue(0)
  const backdropOpacity = useTransform(dragY, [0, 300], [1, 0.2])

  const group = storyGroups[activeGroupIndex]
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)

  // When the group changes (next/previous group) start again from its first story. Done while
  // rendering, not in an effect: with an effect the first render of the new group would still use the
  // old index, which can be past the end of a shorter group.
  const [shownGroupId, setShownGroupId] = useState(group.userId)
  if (shownGroupId !== group.userId) {
    setShownGroupId(group.userId)
    setCurrent(0)
  }

  // The progress bar does not live in React state: a requestAnimationFrame loop writes the width
  // (scaleX, so it runs on the compositor) straight into the bar of the current story. That gives a
  // smooth 60 fps fill with no re-render per frame. elapsedRef keeps the time already played, so
  // pausing (press and hold) and resuming continues from the same point.
  const barRef = useRef(null)
  const elapsedRef = useRef(0)
  const paintBar = (ratio) => {
    if (barRef.current) barRef.current.style.transform = `scaleX(${ratio})`
  }
  const restartBar = () => {
    elapsedRef.current = 0
    paintBar(0)
  }

  const goNext = () => {
    if (current < group.stories.length - 1) setCurrent(c => c + 1)
    else onNextGroup()
  }
  // The timer calls the latest goNext without restarting every time it is recreated.
  const goNextRef = useRef(goNext)
  useEffect(() => { goNextRef.current = goNext })

  // First story: "previous" starts it again. After the first story it goes back one.
  const goPrev = () => {
    if (current > 0) setCurrent(c => c - 1)
    else restartBar()
  }

  // A new story starts with an empty bar.
  useEffect(() => { restartBar() }, [current, group.userId]) // eslint-disable-line react-hooks/exhaustive-deps -- restartBar only touches refs

  useEffect(() => {
    if (paused) return
    let frame
    let last = performance.now()
    const tick = (now) => {
      elapsedRef.current += now - last
      last = now
      const ratio = Math.min(elapsedRef.current / STORY_MS, 1)
      paintBar(ratio)
      if (ratio >= 1) {
        goNextRef.current()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paused, current, group.userId])

  // Left third = previous, the rest = next. Pressing and holding pauses; releasing after a hold
  // only resumes (see usePressGestures), it never advances.
  const gestures = usePressGestures({
    onPress: () => setPaused(true),
    onRelease: () => setPaused(false),
    onTap: (zone) => (zone === 'left' ? goPrev() : goNext()),
  })

  // The browser Back button closes the viewer (it has its own history entry, see useOverlayHistory).
  const { leaveThen } = useOverlayHistory(onClose)

  // Keyboard: Escape closes, arrows move between stories. The close button gets the focus when the
  // viewer opens and the previously focused element gets it back when it closes.
  const closeButtonRef = useRef(null)
  const actionsRef = useRef({})
  useEffect(() => { actionsRef.current = { goNext, goPrev, onClose } })
  useEffect(() => {
    const previouslyFocused = document.activeElement
    closeButtonRef.current?.focus()
    const onKeyDown = (e) => {
      if (e.key === 'Escape') actionsRef.current.onClose()
      else if (e.key === 'ArrowRight') actionsRef.current.goNext()
      else if (e.key === 'ArrowLeft') actionsRef.current.goPrev()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [])

  // While the viewer is open, pull-to-refresh is off (see Layout), so a swipe down cannot refresh the feed.
  useEffect(() => lockOverlay(), [])

  // Load the next story's image ahead of time so changing story does not flash an empty frame.
  const nextImage = group.stories[current + 1]?.image_url ?? storyGroups[activeGroupIndex + 1]?.stories[0]?.image_url
  useEffect(() => {
    if (nextImage) new Image().src = nextImage
  }, [nextImage])

  // Clamped: for the one render in which the group has just changed, `current` is still the old index.
  const story = group.stories[Math.min(current, group.stories.length - 1)]

  const enterExit = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Historias de ${group.username}`}
      className="fixed inset-0 z-50 flex items-center justify-center select-none"
      initial={enterExit}
      animate={{ opacity: 1, scale: 1 }}
      exit={enterExit}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
    >
      <motion.div className="absolute inset-0 bg-black" style={{ opacity: backdropOpacity }} />

      <motion.div
        className="relative w-full max-w-md h-full"
        style={{ y: dragY }}
        drag="y"
        dragDirectionLock
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, info) => { if (shouldCloseOnSwipe(info.offset.y, info.velocity.y)) onClose() }}
      >
        <div className="absolute inset-0 overflow-hidden">

          {/* Progress bars */}
          <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
            {group.stories.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  ref={i === current ? barRef : undefined}
                  className="h-full w-full origin-left bg-white will-change-transform"
                  style={{ transform: i < current ? 'scaleX(1)' : 'scaleX(0)' }}
                />
              </div>
            ))}
          </div>

          {/* Story content: left third = previous, the rest = next, press and hold = pause */}
          <div
            className="absolute inset-0 flex items-center justify-center bg-gray-900"
            data-testid="story-area"
            {...gestures}
          >
            {story.image_url ? (
              <motion.img
                key={story.id}
                src={story.image_url}
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
                style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.15 }}
              />
            ) : (
              <span className="text-8xl pointer-events-none">{story.emoji ?? '🛍️'}</span>
            )}
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-6 left-3 right-3 text-white pointer-events-none z-20">
            <p className="text-sm font-medium drop-shadow">{story.product}</p>
            {story.caption && <p className="text-xs text-white/80 mt-1 drop-shadow">{story.caption}</p>}
            {story.price && <p className="text-green-300 text-xs mt-1 drop-shadow">${formatPrice(story.price)}</p>}
          </div>

        </div>

        {/* Profile & close buttons: siblings of the content, so the gesture area never sees their presses */}
        <button
          onClick={(e) => { e.stopPropagation(); leaveThen(() => navigate(`/user/${group.userId}`)) }}
          aria-label={`Ver perfil de ${group.username}`}
          className="absolute top-7 left-3 z-50 flex items-center gap-2"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
        >
          <StoryAvatar url={group.avatarUrl} username={group.username} />
          <span className="text-white text-sm font-medium">{group.username}</span>
        </button>

        <button
          ref={closeButtonRef}
          onClick={(e) => { e.stopPropagation(); onClose() }}
          aria-label="Cerrar historias"
          className="absolute top-7 right-3 z-50 text-white p-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </motion.div>
    </motion.div>
  )
}

export default StoryViewer
