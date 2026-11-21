import { supabase } from '../lib/supabase'

// Put a post on sale or take it off. It asks the database for ONLY the column it changed
// (select('for_sale')), and returns just that, as { for_sale }. The row that comes back has no
// join (no profiles), so it must be merged into the post that is already on screen and never
// replace it.
//
// With row level security, an UPDATE the user is not allowed to do matches no row and returns NO
// error, so the screen would show a change that was never saved. The affected ids come back
// (select) and an empty answer throws, so the caller can undo the change.
export async function setPostForSale(postId, forSale) {
  const { data, error } = await supabase
    .from('posts')
    .update({ for_sale: forSale })
    .eq('id', postId)
    .select('id, for_sale')
  if (error) throw error
  if (!data?.length) throw new Error('Post was not updated (no matching row or no permission)')
  return { for_sale: data[0].for_sale }
}
