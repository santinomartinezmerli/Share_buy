import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Feed from './Feed'

const ME = 'me'
const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString()
const post = (id, userId, hours = 1) => ({
  id, user_id: userId, created_at: hoursAgo(hours), product: `p-${id}`, profiles: { username: `u-${userId}` },
})

let feed
vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
vi.mock('../hooks/useFeed', () => ({ useFeed: () => feed }))
vi.mock('../hooks/useNotifications', () => ({ useUnreadNotificationsCount: () => 0 }))
vi.mock('../hooks/useDeferredStart', () => ({ useDeferredStart: () => false }))
vi.mock('../lib/UserContext', () => ({ useUser: () => ({ userId: 'me' }) }))
vi.mock('../components/PostCard', () => ({ default: ({ post: p }) => <div data-testid="post">{p.product}</div> }))
vi.mock('../components/CommentSheet', () => ({ default: () => null }))
vi.mock('../components/StoryViewer', () => ({ default: () => <div data-testid="viewer" /> }))

const loaded = (posts) => ({ posts, loading: false, loadingMore: false, hasMore: false, loadMore: () => {} })
const renderFeed = () => render(<MemoryRouter><Feed /></MemoryRouter>)

describe('Feed stories row', () => {
  beforeEach(() => { feed = null })
  afterEach(cleanup) // vitest has no globals, so Testing Library does not clean up by itself

  it('reserves no space for stories while the feed loads', () => {
    feed = { posts: [], loading: true, loadingMore: false, hasMore: false, loadMore: () => {} }
    const { container } = renderFeed()
    expect(screen.queryByTestId('stories-row')).toBeNull()
    expect(container.querySelectorAll('.animate-pulse').length).toBe(3) // only the post skeletons
  })

  it('shows the row, in the same render as the posts, when other users have stories', () => {
    feed = loaded([post('1', 'ana'), post('2', ME)])
    renderFeed()
    expect(screen.getByTestId('stories-row')).toBeTruthy()
    expect(screen.getAllByTestId('post')).toHaveLength(2)
  })

  it('shows the row when the only story is your own', () => {
    feed = loaded([post('1', ME), post('2', 'ana', 48)]) // ana's post is older than 24 h
    renderFeed()
    expect(screen.getByTestId('stories-row')).toBeTruthy()
    expect(screen.getAllByTestId('post')).toHaveLength(2)
  })

  it('hides the row when there are no stories at all', () => {
    feed = loaded([post('1', 'ana', 72)])
    renderFeed()
    expect(screen.queryByTestId('stories-row')).toBeNull()
  })

  it('loads and shows the story viewer (a lazy chunk) when a story is opened', async () => {
    feed = loaded([post('1', 'ana')])
    renderFeed()
    expect(screen.queryByTestId('viewer')).toBeNull()
    const story = screen.getByText('u-ana')
    fireEvent.pointerDown(story) // starts the download
    fireEvent.click(story)
    expect(await screen.findByTestId('viewer')).toBeTruthy()
  })
})
