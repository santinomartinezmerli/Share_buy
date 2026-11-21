import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageCarousel from './ImageCarousel'
import Avatar from './Avatar'
import { useLike } from '../hooks/useLike'
import { useSave } from '../hooks/useSave'
import { formatPrice } from '../lib/formatPrice'

// priority: the card is above the fold, so its first image skips lazy loading and is fetched with
// high priority (it is the LCP element of the feed). The rest keep loading="lazy".
function PostCard({ post, currentUserId, onCommentClick, priority = false }) {
  const navigate = useNavigate()
  const { liked, likesCount, toggleLike } = useLike(post, currentUserId)
  const { saved, toggleSave } = useSave(post, currentUserId)

  const imageUrls = (post.image_urls && post.image_urls.length > 0)
    ? post.image_urls
    : (post.image_url ? [post.image_url] : [])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm mx-4 mb-5 overflow-hidden">
      {/* Header: avatar, user and a small grey date */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button onClick={() => navigate(`/user/${post.user_id}`)} className="flex-shrink-0">
          <Avatar url={post.profiles?.avatar_url} username={post.profiles?.username} size="md" />
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => navigate(`/user/${post.user_id}`)} className="text-sm font-semibold text-gray-900 dark:text-white truncate block max-w-full text-left leading-tight">
            {post.profiles?.username ?? 'usuario'}
          </button>
          <span className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight block">{new Date(post.created_at).toLocaleDateString('es-AR')}</span>
        </div>
      </div>

      {/* Image. The carousel case is a div with role=button, not a <button>, because the carousel has
          its own buttons inside. */}
      <div className="px-2">
        {imageUrls.length > 1 ? (
          <motion.div
            role="button"
            tabIndex={0}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(`/post/${post.id}`, { state: { post } })}
            onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); navigate(`/post/${post.id}`, { state: { post } }) } }}
            className="w-full block cursor-pointer"
          >
            <ImageCarousel images={imageUrls} brand={post.brand} className="rounded-xl" priority={priority} />
          </motion.div>
        ) : imageUrls.length === 1 ? (
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate(`/post/${post.id}`, { state: { post } })} className="w-full block">
            <div className="relative aspect-square bg-gray-50 dark:bg-gray-700 rounded-xl overflow-hidden">
              <img src={imageUrls[0]} className="w-full h-full object-cover" alt="" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async" />
              {post.brand && (
                <span className="absolute bottom-2 left-2 bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-sm">
                  {post.brand}
                </span>
              )}
            </div>
          </motion.button>
        ) : (
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate(`/post/${post.id}`, { state: { post } })} className="w-full">
            <div className="aspect-square bg-gray-50 dark:bg-gray-700 rounded-xl flex items-center justify-center relative overflow-hidden">
              <span className="text-6xl">{post.emoji ?? '🛍️'}</span>
              {post.brand && (
                <span className="absolute bottom-2 left-2 bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-sm">
                  {post.brand}
                </span>
              )}
            </div>
          </motion.button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center px-4 pt-3 pb-1">
        <div className="flex items-center gap-1">
          <button onClick={toggleLike} className="p-1 -ml-1 active:scale-95 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className={`w-[22px] h-[22px] transition-[color,fill,scale] ${liked ? 'text-red-500 fill-red-500 scale-110' : 'text-gray-400 dark:text-gray-500'}`} viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
          <button onClick={() => onCommentClick(post.id)} className="p-1 active:scale-95 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-[22px] h-[22px] text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>
        <button onClick={toggleSave} className="ml-auto p-1 -mr-1 active:scale-95 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-[22px] h-[22px] ${saved ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400 dark:text-gray-500'}`} viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      </div>

      {/* Likes count */}
      {likesCount > 0 && (
        <div className="px-4 pt-0.5">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {likesCount} <span className="font-normal text-gray-500 dark:text-gray-400">like{likesCount !== 1 ? 's' : ''}</span>
          </span>
        </div>
      )}

      {/* One strong line: title and price. The place of purchase is a clear tag under it. */}
      <div className="px-4 pt-1.5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-semibold text-gray-900 dark:text-white truncate">{post.product}</p>
          {post.price && (
            <span className="flex-shrink-0 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-semibold px-2.5 py-0.5">
              ${formatPrice(post.price)}
            </span>
          )}
        </div>
        {post.where_bought && (
          <span className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700/60 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">Comprado en {post.where_bought}</span>
          </span>
        )}
        {post.caption && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">{post.caption}</p>}
      </div>
    </div>
  )
}

export default PostCard
