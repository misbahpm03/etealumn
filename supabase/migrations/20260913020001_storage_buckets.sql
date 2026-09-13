-- Phase 5: private storage buckets + deny-by-default storage posture.
--
-- ALL buckets are private (`public = false`). There are deliberately NO
-- `storage.objects` policies for `anon`/`authenticated` — not an omission, the
-- architecture: document visibility is far more complex than path ownership
-- (status × visibility × grants × roles), so duplicating it into storage
-- policies would create drift-prone, recursive authorization. Instead every
-- file operation is server-mediated:
--
--   1. Server loads the database record through the requester's RLS context.
--   2. RLS (plus `can_access_document()`) decides visibility — invisible
--      records arrive as null and no URL is ever minted for them.
--   3. Only then does the server upload/move/sign via a privileged client.
--
-- Clients therefore cannot list, download, upload into, overwrite, or delete
-- any object directly: RLS on `storage.objects` (enabled below; Supabase
-- enables it by default) denies everything without a permissive policy.
-- A storage path is never authorization — knowing a path grants nothing.
--
-- Bucket-level guardrails below (size caps, MIME allowlists) are
-- defense-in-depth backstops. The primary validation lives in
-- `src/config/storage.ts` + `src/validations/uploads.ts` and runs in the
-- services on every upload — keep the two lists in sync manually (SQL and
-- TypeScript share no constants).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('profile-media', 'profile-media', false, 26214400,
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('academic-archive', 'academic-archive', false, 26214400,
    ARRAY['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/markdown', 'text/csv', 'application/x-tex',
      'image/png', 'image/jpeg', 'application/zip']),
  ('story-media', 'story-media', false, 26214400,
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('achievement-media', 'achievement-media', false, 26214400,
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('department-memory-media', 'department-memory-media', false, 26214400,
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
-- Idempotent AND self-healing: re-running enforces private + guardrails even
-- if a bucket was pre-created (e.g. via dashboard) with weaker settings.
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Apply-time confirmation of the deny stance (informational only).
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects';
  RAISE NOTICE 'storage.objects policies: % (expected 0 — server-mediated access only)', policy_count;
END;
$$;
