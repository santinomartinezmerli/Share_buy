-- Migration 009: lock down permissions (anon, extra privileges, open policies).
--
-- The audit found that Supabase's default privileges give anon and
-- authenticated EVERY privilege (including TRUNCATE, TRIGGER and REFERENCES) on
-- every table of public, and that the app does not need most of it:
--   - The app has no screen that reads or writes tables without a session:
--     before signing in it only calls supabase.auth (signInWithPassword,
--     signUp, signInWithOAuth). So anon gets NO access to tables or sequences.
--   - authenticated keeps only what the client really does, table by table and
--     COLUMN by column for INSERT and UPDATE, as 008 already did for messages:
--     nobody can write owner ids (except on INSERT, where RLS pins them to
--     auth.uid()), created_at, the counters kept by triggers, or columns the
--     app never edits. RLS cannot limit columns, grants can.
--   - Policies that were created for the "public" role are moved to
--     authenticated, and the duplicated profiles policies are removed.
--   - New tables, sequences and functions no longer are born open.
--
-- Not changed: SELECT stays table-wide for authenticated (the RPCs and the
-- screens read every column) and the row rules of the existing policies.
--
-- Whole migration runs in ONE transaction: it applies fully or not at all.
-- Idempotent: every step can be run again.
--
-- Deploy note: nothing in the client has to change first. The grants below were
-- checked against every INSERT / UPDATE / UPSERT / DELETE in src.
--
-- ROLLBACK (run manually, back to the previous wide-open state):
--   GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
--   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
--   GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT ALL ON TABLES TO anon, authenticated;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT ALL ON SEQUENCES TO anon, authenticated;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres
--     GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
--   -- Then restore the narrower grants of 007 (notifications) and 008
--   -- (messages) by running their GRANT / REVOKE sections again.
--   -- Policies: ALTER POLICY <name> ON public.<table> TO public; for each
--   -- policy that 009 moved, and recreate the two removed duplicates:
--   CREATE POLICY "Profiles son visibles para todos" ON public.profiles
--     FOR SELECT TO public USING (true);
--   CREATE POLICY "Usuario edita su propio perfil" ON public.profiles
--     FOR INSERT TO public WITH CHECK (auth.uid() = id);
--   NOTIFY pgrst, 'reload schema';

BEGIN;


-- 1. Guard. This migration lists the grants of EVERY table of public. If a
--    table exists that is not listed, it would be left with no access at all
--    for the app, so it stops here and says which one.
DO $$
DECLARE
  unexpected text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO unexpected
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relkind IN ('r', 'p')
    AND c.relname NOT IN (
      'blocked_users', 'comments', 'conversations', 'follows', 'likes',
      'messages', 'notifications', 'posts', 'profiles', 'reports',
      'reviews', 'saves');
  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION
      'Tables of public not covered by migration 009: %', unexpected;
  END IF;
END
$$;


-- 2. Start from nothing. REVOKE ALL on a table also removes its column
--    privileges, so the grants below are the complete, final list.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;


-- 3. What authenticated can do, table by table. SELECT is table-wide; INSERT
--    and UPDATE are per column, exactly the columns the client sends.
--    Everything not listed (TRUNCATE, TRIGGER, REFERENCES, other columns) is
--    denied. anon gets nothing.

-- blocked_users: block (insert), unblock (delete), list.
GRANT SELECT, DELETE ON public.blocked_users TO authenticated;
GRANT INSERT (blocker_id, blocked_id) ON public.blocked_users TO authenticated;

-- comments: write, edit the text, delete, read.
GRANT SELECT, DELETE ON public.comments TO authenticated;
GRANT INSERT (post_id, user_id, content) ON public.comments TO authenticated;
GRANT UPDATE (content) ON public.comments TO authenticated;

-- conversations: start one, read mine. Never edited or deleted by the client.
GRANT SELECT ON public.conversations TO authenticated;
GRANT INSERT (user1_id, user2_id) ON public.conversations TO authenticated;

-- follows: follow, unfollow, read.
GRANT SELECT, DELETE ON public.follows TO authenticated;
GRANT INSERT (follower_id, following_id) ON public.follows TO authenticated;

-- likes: like, unlike, read. likes_count is kept by a trigger.
GRANT SELECT, DELETE ON public.likes TO authenticated;
GRANT INSERT (post_id, user_id) ON public.likes TO authenticated;

-- messages: as set by 008.
GRANT SELECT, DELETE ON public.messages TO authenticated;
GRANT INSERT (conversation_id, sender_id, content)
  ON public.messages TO authenticated;
GRANT UPDATE (content, updated_at) ON public.messages TO authenticated;

-- notifications: as set by 007 (only the triggers create and delete rows).
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

-- posts: publish (NewPost), edit (EditPost, and the for_sale switch of
-- PostDetail), delete, read. user_id can only be set on INSERT (RLS pins it to
-- auth.uid()) and never changed; created_at, emoji, sale_price and the counters
-- are not writable (the client never writes them).
GRANT SELECT, DELETE ON public.posts TO authenticated;
GRANT INSERT (user_id, product, brand, price, where_bought, caption, category,
  image_url, image_urls) ON public.posts TO authenticated;
GRANT UPDATE (product, brand, price, where_bought, caption, category, for_sale)
  ON public.posts TO authenticated;

-- profiles: read, create (App, SetupProfile) and edit (SetupProfile,
-- EditProfile). The client uses UPSERT, which is INSERT ... ON CONFLICT (id) DO
-- UPDATE SET <every column sent>, so id has to be updatable too; it is harmless
-- because the update policy requires id = auth.uid() before and after. The
-- counters (followers_count, following_count) and created_at are not writable.
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT (id, username, bio, avatar_url, setup_complete)
  ON public.profiles TO authenticated;
GRANT UPDATE (id, username, bio, avatar_url, setup_complete)
  ON public.profiles TO authenticated;

-- reports: report a post. Nobody reads them from the app: no SELECT (you read
-- them in the dashboard, as postgres).
GRANT INSERT (post_id, reported_by, reason) ON public.reports TO authenticated;

-- reviews: write, edit the text, delete, read. rating cannot be changed after.
GRANT SELECT, DELETE ON public.reviews TO authenticated;
GRANT INSERT (post_id, user_id, rating, content, recommended)
  ON public.reviews TO authenticated;
GRANT UPDATE (content) ON public.reviews TO authenticated;

-- saves: save, unsave, read.
GRANT SELECT, DELETE ON public.saves TO authenticated;
GRANT INSERT (post_id, user_id) ON public.saves TO authenticated;


-- 4. Sequences. Some ids (blocked_users, reports, saves) come from a sequence,
--    and inserting needs USAGE on it. Nothing else: no setval, no UPDATE.
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- 5. Functions. The audit found the existing ones fine; this only makes sure
--    anon cannot run any of them. (Each RPC already grants EXECUTE to
--    authenticated in its own migration.)
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;


-- 6. Default privileges, so what is created from now on is not born open.
--    These are the privileges Supabase hands to anon and authenticated on every
--    new table, sequence and function. Migrations run as postgres, so that is
--    the role whose defaults matter; supabase_admin (the dashboard's own role)
--    is tried too and skipped with a notice if it is not allowed.
--    Functions are also born with EXECUTE for PUBLIC, which anon inherits, so
--    that default is removed globally (the schema-level form cannot subtract
--    it). From now on every new function needs an explicit GRANT EXECUTE, which
--    all the migrations already do.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon, authenticated;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
    REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Default privileges of supabase_admin not changed (no access)';
END
$$;


-- 7. Policies.
--    7a. profiles had two SELECT and two INSERT policies that said the same
--        (the Spanish-named ones are the old duplicates). The ones kept are
--        profiles_select, profiles_insert and profiles_update.
DROP POLICY IF EXISTS "Profiles son visibles para todos" ON public.profiles;
DROP POLICY IF EXISTS "Usuario edita su propio perfil" ON public.profiles;

--    7b. Every policy created for the "public" role (which includes anon) is
--        moved to authenticated. ALTER POLICY changes only the roles: the USING
--        and WITH CHECK expressions stay exactly as they are. Running it again
--        finds nothing left to move.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.tablename, p.policyname
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.roles = ARRAY['public']::name[]
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated',
                   r.policyname, r.tablename);
  END LOOP;
END
$$;

--    7c. Guard: profiles must still be readable, creatable and editable.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'profiles' AND cmd IN ('SELECT', 'ALL'))
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                    AND tablename = 'profiles' AND cmd IN ('INSERT', 'ALL'))
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                    AND tablename = 'profiles' AND cmd IN ('UPDATE', 'ALL'))
  THEN
    RAISE EXCEPTION 'profiles lost a SELECT, INSERT or UPDATE policy';
  END IF;
END
$$;


-- 8. Tell PostgREST (the API) to reload its schema cache. It is delivered when
--    the transaction commits.
NOTIFY pgrst, 'reload schema';


COMMIT;

-- Right after the COMMIT, this must show 0, 0, 0 and 3: no policy left for the
-- public role, no table privilege for anon, no TRUNCATE / TRIGGER / REFERENCES
-- for authenticated, and exactly the three profiles policies.
SELECT (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'public' AND roles = ARRAY['public']::name[])
         AS left_public_policies,
       (SELECT count(*) FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND grantee = 'anon')
         AS anon_table_grants,
       (SELECT count(*) FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND grantee = 'authenticated'
          AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES'))
         AS auth_dangerous_grants,
       (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'profiles')
         AS profiles_policies;
