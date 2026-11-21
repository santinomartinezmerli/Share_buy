import { useProfileStats } from '../hooks/useProfileStats'

function Item({ value, label }) {
  return (
    <div className="flex-1 min-w-0 text-center">
      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{value}</div>
      <div className="text-[11px] text-gray-400 dark:text-gray-500">{label}</div>
    </div>
  )
}

// A strip under the profile header: purchases, different stores and the most frequent category.
// It has a fixed height from the first render (a placeholder while the stats load), so the grid
// below never moves when the numbers arrive. Rendered only for profiles with at least one post.
function ProfileSummaryStrip({ profileId, total }) {
  const { data } = useProfileStats(profileId)
  if (!total) return null

  return (
    <div className="flex h-14 items-center divide-x divide-gray-100 dark:divide-gray-700 border-b border-gray-100 dark:border-gray-700 px-2">
      <Item value={total} label={total === 1 ? 'compra' : 'compras'} />
      <Item value={data ? data.storesCount : '–'} label={data?.storesCount === 1 ? 'tienda' : 'tiendas'} />
      <Item value={data ? (data.topCategory ?? '–') : '–'} label="categoría top" />
    </div>
  )
}

export default ProfileSummaryStrip
