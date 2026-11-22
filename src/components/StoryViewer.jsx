import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePressGestures } from '../hooks/usePressGestures'

// How long each story stays on screen.
const STORY_MS = 5000

function StoryViewer({ storyGroups, activeGroupIndex, onClose, onNextGroup }) {
  const navigate = useNavigate()
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

  // Clamped: for the one render in which the group has just changed, `current` is still the old index.
  const story = group.stories[Math.min(current, group.stories.length - 1)]

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center select-none">
      <div className="relative w-full max-w-md h-full overflow-hidden">

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

        {/* Story content with tap-to-advance */}
        <div
          className="absolute inset-0 flex items-center justify-center bg-gray-900"
          data-testid="story-area"
          {...gestures}
        >
          {story.image_url ? (
            <img
              src={story.image_url}
              className="w-full h-full object-contain pointer-events-none"
              draggable={false}
              style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
            />
          ) : (
            <span className="text-8xl pointer-events-none">{story.emoji ?? '🛍️'}</span>
          )}
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-6 left-3 right-3 text-white pointer-events-none z-20">
          <p className="text-sm font-medium drop-shadow">{story.product}</p>
          {story.caption && <p className="text-xs text-white/80 mt-1 drop-shadow">{story.caption}</p>}
          {story.price && <p className="text-green-300 text-xs mt-1 drop-shadow">${story.price}</p>}
        </div>

      </div>

      {/* Profile & close buttons - outside inner container to avoid stacking conflicts */}
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/user/${group.userId}`) }}
        className="absolute top-7 left-3 z-50 flex items-center gap-2"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
      >
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-medium shrink-0">
          {group.username?.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-white text-sm font-medium">{group.username}</span>
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        className="absolute top-7 right-3 z-50 text-white p-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default StoryViewer
