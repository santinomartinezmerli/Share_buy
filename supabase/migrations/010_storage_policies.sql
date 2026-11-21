-- Migration 010: storage policies, size limits and image-only buckets.
--
-- The audit of storage.objects found:
--   - avatars_update, avatars_delete and chat_update only check the bucket, so
--     ANY signed-in user can overwrite or delete files of other people.
--   - avatars_select and chat_select are for the public role: the buckets can
--     be listed without an account. (The buckets are public, so an image is
--     reached by its URL without any SELECT policy; the policy only opens the
--     listing and the download API.)
--   - The posts bucket has only INSERT, and no bucket restricts size or type.
--   - Every file name is flat (avatar-<uid>-<ts>.webp, <uid>-<ts>-<rand>.webp,
--     chat-<uid>-<ts>-<rand>.webp): nothing ties a file to its owner in the
--     path.
--
-- After this migration, for avatars, posts and chat:
--   - INSERT: only inside a folder named with your own id: <uid>/<file>.
--   - UPDATE and DELETE: only the owner (owner_id = auth.uid()). This works for
--     the 61 existing flat-named files too, because they all have an owner_id.
--   - SELECT: only your own files (needed by upload with upsert). Nobody lists
--     other people's files. Reading an image by its public URL is not affected.
--   - Size limit and image types, enforced by the Storage API on new uploads.
--   The chat bucket stays PUBLIC to read on purpose (images are shown by URL in
--   the conversation). It is a conscious decision, documented in the README:
--   whoever has the URL can see the image, but cannot list, replace or delete.
--
-- Whole migration runs in ONE transaction: it applies fully or not at all.
-- Idempotent: it drops the policies of these three buckets and creates them.
--
-- DEPLOY ORDER (the opposite of migration 008): FIRST deploy the client that
-- uploads to <uid>/<file>, THEN apply this migration. The INSERT policy rejects
-- flat names, so applying it before that client is live breaks every upload.
--
-- The limits and types below are a decision to review against the current
-- bucket settings (audit query Q9). They are enforced by the Storage API, not
-- by SQL, and only for new uploads: files already stored are not touched.
--
-- ROLLBACK (run manually):
--   DROP POLICY IF EXISTS avatars_insert_own_folder ON storage.objects;
--   DROP POLICY IF EXISTS avatars_select_own ON storage.objects;
--   DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
--   DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
--   DROP POLICY IF EXISTS posts_insert_own_folder ON storage.objects;
--   DROP POLICY IF EXISTS posts_select_own ON storage.objects;
--   DROP POLICY IF EXISTS posts_update_own ON storage.objects;
--   DROP POLICY IF EXISTS posts_delete_own ON storage.objects;
--   DROP POLICY IF EXISTS chat_insert_own_folder ON storage.objects;
--   DROP POLICY IF EXISTS chat_select_own ON storage.objects;
--   DROP POLICY IF EXISTS chat_update_own ON storage.objects;
--   DROP POLICY IF EXISTS chat_delete_own ON storage.objects;
--   CREATE POLICY avatars_select ON storage.objects FOR SELECT TO public
--     USING (bucket_id = 'avatars');
--   CREATE POLICY chat_select ON storage.objects FOR SELECT TO public
--     USING (bucket_id = 'chat');
--   CREATE POLICY avatars_insert ON storage.objects FOR INSERT
--     TO authenticated WITH CHECK (bucket_id = 'avatars');
--   CREATE POLICY chat_insert ON storage.objects FOR INSERT
--     TO authenticated WITH CHECK (bucket_id = 'chat');
--   CREATE POLICY "usuarios pueden subir fotos 1rma4z_0" ON storage.objects
--     FOR INSERT TO authenticated WITH CHECK (bucket_id = 'posts');
--   CREATE POLICY avatars_update ON storage.objects FOR UPDATE
--     TO authenticated USING (bucket_id = 'avatars');
--   CREATE POLICY avatars_delete ON storage.objects FOR DELETE
--     TO authenticated USING (bucket_id = 'avatars');
--   CREATE POLICY chat_update ON storage.objects FOR UPDATE
--     TO authenticated USING (bucket_id = 'chat');
--   -- Limits and types: set them back to the values Q9 showed before 010, for
--   -- example (null = no limit / any type):
--   UPDATE storage.buckets SET file_size_limit = NULL,
--     allowed_mime_types = NULL WHERE id IN ('avatars', 'posts', 'chat');

BEGIN;


-- 1. Guard: the three buckets must exist.
DO $$
BEGIN
  IF (SELECT count(*) FROM storage.buckets
      WHERE id IN ('avatars', 'posts', 'chat')) <> 3 THEN
    RAISE EXCEPTION 'The buckets avatars, posts and chat must all exist';
  END IF;
END
$$;


-- 2. Size limit (bytes) and allowed types. Photos are compressed in the browser
--    (WebP, 1280px for posts and chat, 512px for avatars), so these are far
--    above a normal upload. Only the fallback of compressImage, which uploads
--    the ORIGINAL of a photo it could not compress, can get near them (a clear
--    upload error is shown then). The public flag of the buckets is left as it
--    is.
UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png',
                               'image/gif']
WHERE id = 'avatars';

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png',
                               'image/gif']
WHERE id IN ('posts', 'chat');


-- 3. Remove every current policy of these three buckets (whatever its name),
--    including the old open ones. Policies of other buckets are not touched. It
--    matches the bucket check the policies have, for example
--    (bucket_id = 'avatars'::text).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.policyname
    FROM pg_policies p
    WHERE p.schemaname = 'storage'
      AND p.tablename = 'objects'
      AND (coalesce(p.qual, '') ~ 'bucket_id = ''(avatars|posts|chat)'''
           OR coalesce(p.with_check, '') ~
                'bucket_id = ''(avatars|posts|chat)''')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', r.policyname);
  END LOOP;
END
$$;


-- 4. The new policies, the same four for each bucket.
--    (SELECT auth.uid()) is evaluated once per query instead of once per row.
--    storage.foldername(name) splits the path: for 'abc/photo.webp' it returns
--    {abc}, so [1] is the first folder.

-- avatars
CREATE POLICY avatars_insert_own_folder ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars'
              AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY avatars_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND owner_id = (SELECT auth.uid())::text);
CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND owner_id = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'avatars'
              AND owner_id = (SELECT auth.uid())::text);
CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND owner_id = (SELECT auth.uid())::text);

-- posts
CREATE POLICY posts_insert_own_folder ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'posts'
              AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY posts_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'posts' AND owner_id = (SELECT auth.uid())::text);
CREATE POLICY posts_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'posts' AND owner_id = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'posts'
              AND owner_id = (SELECT auth.uid())::text);
CREATE POLICY posts_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'posts' AND owner_id = (SELECT auth.uid())::text);

-- chat (public to read by URL, but not listable and only the owner changes it)
CREATE POLICY chat_insert_own_folder ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat'
              AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY chat_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat' AND owner_id = (SELECT auth.uid())::text);
CREATE POLICY chat_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'chat' AND owner_id = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'chat'
              AND owner_id = (SELECT auth.uid())::text);
CREATE POLICY chat_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat' AND owner_id = (SELECT auth.uid())::text);


COMMIT;

-- Right after the COMMIT: 12 policies (4 per bucket), none for the public
-- role, and the limits and types of each bucket.
SELECT (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname ~ '^(avatars|posts|chat)_')
         AS bucket_policies,
       (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND roles = ARRAY['public']::name[])
         AS public_role_policies;

SELECT b.id AS bkt_id,
       b.public AS bkt_public,
       b.file_size_limit AS bkt_size_limit,
       b.allowed_mime_types::text AS bkt_mime_types
FROM storage.buckets b
WHERE b.id IN ('avatars', 'posts', 'chat')
ORDER BY b.id;
