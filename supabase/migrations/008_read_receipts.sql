-- Migration 008: read receipts and unread counts from the database.
--
-- Until now "read" lived in each browser (localStorage chatLastRead): the
-- unread badge and the unread count of each conversation were computed on the
-- client, and the sender never found out that a message was read (the "Leido"
-- tick never showed because the recipient is not allowed to UPDATE a message
-- of someone else). This moves it to messages.read_at (null = not read):
--   - mark_conversation_read(conversation): the ONLY way to mark messages as
--     read. SECURITY DEFINER; it marks only what the OTHER user sent, and only
--     if the caller is part of the conversation. Returns how many it marked.
--   - get_unread_messages_count(): total unread, for the badge in Layout.
--   - get_conversations: unread_count now counts messages.read_at IS NULL. The
--     p_last_read parameter (the localStorage map) is gone, so the signature
--     changes and the old function is dropped.
--   - Column privileges: a signed-in user can no longer write read_at (or any
--     column other than content and updated_at on UPDATE, or anything other
--     than conversation_id, sender_id and content on INSERT) directly.
--   - Backfill: every existing message is marked as read, no wall of unread.
--
-- Whole migration runs in ONE transaction: it applies fully or not at all.
-- Idempotent: every step can be run again.
--
-- ROLLBACK (run manually, in this order):
--   DROP FUNCTION IF EXISTS public.get_unread_messages_count();
--   DROP FUNCTION IF EXISTS public.mark_conversation_read(uuid);
--   DROP FUNCTION IF EXISTS public.get_conversations(int, timestamptz, uuid);
--   -- Recreate the old get_conversations: run sections 2 and 3 of
--   -- supabase/migrations/005_pagination.sql again.
--   DROP INDEX IF EXISTS public.idx_messages_unread;
--   REVOKE UPDATE (content, updated_at) ON public.messages FROM authenticated;
--   REVOKE INSERT (conversation_id, sender_id, content)
--     ON public.messages FROM authenticated;
--   GRANT INSERT, UPDATE ON public.messages TO anon, authenticated;
--   -- Not undone: messages.read_at existed before this migration and stays,
--   -- and the backfill cannot be reversed (the old values were not saved).
--   -- messages stays in the supabase_realtime publication.
--   NOTIFY pgrst, 'reload schema';

BEGIN;


-- 1. The column. It already exists in the real database (the client reads it
--    since the chat was written); this only makes the migration safe to run on
--    a database that does not have it.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;


-- 2. Index for unread messages. Partial: it only holds the rows with
--    read_at IS NULL, which is a tiny part of the table once the backfill ran.
--    The recipient is the participant who is NOT the sender, so the index is by
--    conversation and sender: "unread in this conversation not sent by me".
--    Serves the unread count of get_conversations, the badge and
--    mark_conversation_read.
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON public.messages (conversation_id, sender_id)
  WHERE read_at IS NULL;


-- 3. Column privileges. The policy messages_update_own (003) lets the SENDER
--    update their own messages, and Supabase gives authenticated UPDATE on the
--    whole table, so today a sender could set read_at on their own messages.
--    Table-level UPDATE covers every column, so it has to be revoked first;
--    then only the columns the client really edits are granted back. The
--    sender can still edit content and updated_at. Nobody can write read_at
--    with a direct UPDATE: only mark_conversation_read (below) does.
--
--    The same for INSERT: without it, whoever sends a message could insert it
--    already read (read_at set) and the recipient would never see it as new.
--    The client only sends conversation_id, sender_id and content; id,
--    created_at and updated_at use their defaults.
--
--    This replaces nothing in the RLS policies: they stay as they are.
REVOKE UPDATE ON public.messages FROM anon, authenticated;
GRANT UPDATE (content, updated_at) ON public.messages TO authenticated;

REVOKE INSERT ON public.messages FROM anon, authenticated;
GRANT INSERT (conversation_id, sender_id, content)
  ON public.messages TO authenticated;


-- 4. mark_conversation_read(p_conversation_id): marks as read what the other
--    user sent me in this conversation. Returns how many messages it marked.
--
--    SECURITY DEFINER because the caller has no UPDATE privilege on read_at.
--    The checks that matter are inside the function and use auth.uid() (it
--    reads the request claims, so it is still the caller inside a DEFINER
--    function):
--      - I must be part of the conversation (user1_id or user2_id).
--      - Only messages with sender_id <> me: I can never mark my own messages,
--        and a third person marks nothing because they are not part of it.
--      - Only messages that are still unread: calling it again returns 0 and
--        keeps the original read_at.
--    Without a session (auth.uid() is null) every comparison is null: 0 rows.
--    search_path is fixed so nobody can shadow messages or conversations.
CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  p_conversation_id uuid
)
RETURNS int
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH marked AS (
    UPDATE messages m
    SET read_at = now()
    FROM conversations c
    WHERE m.conversation_id = p_conversation_id
      AND c.id = m.conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
      AND m.sender_id <> auth.uid()
      AND m.read_at IS NULL
    RETURNING m.id
  )
  SELECT count(*)::int FROM marked
$$;


-- 5. get_unread_messages_count(): all the messages I have not read, for the
--    badge in Layout. SECURITY INVOKER: RLS applies, and without a session it
--    returns 0. A conversation with a user I blocked is not counted, the same
--    rule get_conversations uses to hide it, so the badge and the list agree.
CREATE OR REPLACE FUNCTION public.get_unread_messages_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)
  FROM messages m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE m.read_at IS NULL
    AND m.sender_id <> auth.uid()
    AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM blocked_users b
      WHERE b.blocker_id = auth.uid()
        AND b.blocked_id = CASE WHEN c.user1_id = auth.uid()
                                THEN c.user2_id ELSE c.user1_id END
    )
$$;


-- 6. get_conversations: same page of conversations as before (005), but
--    unread_count is now the real number of messages the OTHER user sent me
--    with read_at IS NULL. There is no cap and no localStorage map any more.
--    The signature changes (p_last_read is removed) and CREATE OR REPLACE
--    cannot change the parameters of a function, so the old one is dropped
--    first.
--    IF EXISTS keeps the migration re-runnable.
--
--    Heads up for the rollout: a client that still sends p_last_read gets
--    "function not found" until it is updated, so apply this migration right
--    before deploying the new client.
--
--    Usage: select * from get_conversations(20);
--           select * from get_conversations(20, '<last_message_at>', '<id>');
--    Everything else is as documented in 005: conversations with a user I
--    blocked are hidden, ordered by last_message_at and then id, keyset cursor
--    (send BOTH values from the last row of the previous page, null = first
--    page), limit + 1 to compute has_more, p_limit clamped to 1..50, SECURITY
--    INVOKER.
DROP FUNCTION IF EXISTS public.get_conversations(int, timestamptz, uuid,
  jsonb);

CREATE OR REPLACE FUNCTION public.get_conversations(
  p_limit                   int         DEFAULT 20,
  p_cursor_last_message_at  timestamptz DEFAULT NULL,
  p_cursor_id               uuid        DEFAULT NULL
)
RETURNS TABLE (
  id               uuid,
  user1_id         uuid,
  user2_id         uuid,
  created_at       timestamptz,
  other_user       jsonb,
  last_message     jsonb,
  last_message_at  timestamptz,
  unread_count     bigint,
  has_more         boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH
  cfg AS (
    SELECT least(greatest(coalesce(p_limit, 20), 1), 50) AS n,
           auth.uid()                                     AS uid
  ),
  mine AS (
    SELECT c.id, c.user1_id, c.user2_id, c.created_at,
           CASE WHEN c.user1_id = cfg.uid THEN c.user2_id
                ELSE c.user1_id END                       AS other_id
    FROM conversations c
    CROSS JOIN cfg
    WHERE cfg.uid IS NOT NULL
      AND (c.user1_id = cfg.uid OR c.user2_id = cfg.uid)
  ),
  visible AS (
    SELECT m.id, m.user1_id, m.user2_id, m.created_at, m.other_id,
           pr.username                                    AS other_username,
           pr.avatar_url                                  AS other_avatar,
           lm.id                                          AS lm_id,
           lm.sender_id                                   AS lm_sender,
           lm.content                                     AS lm_content,
           lm.created_at                                  AS lm_created_at,
           coalesce(lm.created_at, m.created_at)          AS last_at
    FROM mine m
    CROSS JOIN cfg
    JOIN profiles pr ON pr.id = m.other_id
    LEFT JOIN LATERAL (
      SELECT msg.id, msg.sender_id, msg.content, msg.created_at
      FROM messages msg
      WHERE msg.conversation_id = m.id
      ORDER BY msg.created_at DESC, msg.id DESC
      LIMIT 1
    ) lm ON true
    WHERE NOT EXISTS (
      SELECT 1 FROM blocked_users b
      WHERE b.blocker_id = cfg.uid
        AND b.blocked_id = m.other_id
    )
  ),
  -- One extra row (n + 1) only to detect whether another page exists.
  page AS (
    SELECT v.*
    FROM visible v
    WHERE p_cursor_last_message_at IS NULL
       OR (v.last_at, v.id) < (p_cursor_last_message_at, p_cursor_id)
    ORDER BY v.last_at DESC, v.id DESC
    LIMIT (SELECT n + 1 FROM cfg)
  ),
  numbered AS (
    SELECT page.*,
           row_number() OVER (ORDER BY page.last_at DESC, page.id DESC)
                                                          AS rn,
           count(*) OVER ()                               AS total
    FROM page
  )
  SELECT
    p.id,
    p.user1_id,
    p.user2_id,
    p.created_at,
    jsonb_build_object('id', p.other_id,
                       'username', p.other_username,
                       'avatar_url', p.other_avatar),
    CASE WHEN p.lm_id IS NULL THEN NULL
         ELSE jsonb_build_object('id', p.lm_id,
                                 'sender_id', p.lm_sender,
                                 'content', p.lm_content,
                                 'created_at', p.lm_created_at)
    END,
    p.last_at,
    (SELECT count(*)
     FROM messages mm
     WHERE mm.conversation_id = p.id
       AND mm.sender_id <> cfg.uid
       AND mm.read_at IS NULL),
    p.total > cfg.n
  FROM numbered p
  CROSS JOIN cfg
  WHERE p.rn <= cfg.n
  ORDER BY p.rn
$$;


-- 7. Backfill: every message that exists is marked as read, so nobody opens the
--    app to a wall of unread messages that the old localStorage logic had
--    already shown as read. now() is used (not created_at) because it is the
--    moment they were marked. Only rows with read_at IS NULL are touched, so
--    re-running it changes nothing, and a message sent after this statement
--    starts stays unread.
--    Scale note: it is one UPDATE over the whole table, and each updated row is
--    also sent to Realtime as an UPDATE event. Fine for a small table; on a big
--    one run it in batches (by conversation_id) before the rest.
UPDATE public.messages
SET read_at = now()
WHERE read_at IS NULL;


-- 8. Realtime. The chat listens to UPDATE on messages to show the tick when
--    the other user reads (and to INSERT, which already works, so messages is
--    normally in the publication already). Guarded: it only adds the table if
--    the publication exists, is not FOR ALL TABLES and does not have it yet.
--    It runs AFTER the backfill, as in 007. Realtime applies the RLS of the
--    table, so each person only receives the messages of their conversations.
DO $$
BEGIN
  IF EXISTS (
       SELECT 1 FROM pg_publication
       WHERE pubname = 'supabase_realtime' AND NOT puballtables)
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END
$$;


-- 9. Permissions. Supabase grants EXECUTE on new functions to anon through
--    default privileges, so PUBLIC and anon are revoked explicitly and only
--    signed-in users get it.
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_unread_messages_count()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_messages_count()
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_conversations(int, timestamptz, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_conversations(int, timestamptz, uuid)
  TO authenticated;


-- 10. Tell PostgREST (the API) to reload its schema cache now, so the new and
--     changed functions are callable at once. It is delivered when the
--     transaction commits.
NOTIFY pgrst, 'reload schema';


COMMIT;

-- Right after the COMMIT, this shows the result of the backfill and whether
-- messages is in the Realtime publication. msgs_unread must be 0 and
-- in_realtime must be 1.
SELECT count(*) AS msgs_total,
       count(*) FILTER (WHERE read_at IS NULL) AS msgs_unread,
       (SELECT count(*) FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'messages') AS in_realtime
FROM public.messages;
