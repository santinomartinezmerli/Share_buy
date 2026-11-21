import { useQuery } from '@tanstack/react-query'
import { fetchProfileStats } from '../services/profiles'
import { profileStatsKey } from '../lib/profileCache'

// { storesCount, topCategory } of a profile, cached for 60s. A failure is not worth an error screen:
// the strip just keeps showing the post count.
export function useProfileStats(profileId) {
  return useQuery({
    queryKey: profileStatsKey(profileId),
    queryFn: async () => {
      try {
        return await fetchProfileStats(profileId)
      } catch (err) {
        console.error('Profile stats request failed:', err)
        throw err
      }
    },
    enabled: !!profileId,
    staleTime: 60_000,
  })
}
