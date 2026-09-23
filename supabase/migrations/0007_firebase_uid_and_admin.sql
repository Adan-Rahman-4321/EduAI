-- ================================================================
-- EduAI Migration 0007: Firebase UID support + Admin setup
-- Run in Supabase Dashboard → SQL Editor → New Query
-- ================================================================

-- 1. Add firebase_uid column to profiles (if not already there)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS firebase_uid TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS email        TEXT,
  ADD COLUMN IF NOT EXISTS child_student_email TEXT;

-- 2. Add index for fast firebase_uid lookups
CREATE INDEX IF NOT EXISTS profiles_firebase_uid_idx
  ON public.profiles (firebase_uid);

-- 3. Drop the old FK constraint that required id = auth.users(id)
--    because we use Firebase Auth, not Supabase Auth
--    (Only run if you get a FK error — Supabase may enforce this)
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 4. Relax the primary key so Firebase UIDs (non-UUID) can be used
--    as the lookup key — keep id as UUID for internal relations,
--    but allow firebase_uid to be the external identity.

-- 5. Update RLS policies to allow service_role full access
--    (required for admin API routes using service_role key)
DROP POLICY IF EXISTS "service_role_bypass" ON public.profiles;
CREATE POLICY "service_role_bypass" ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ================================================================
-- ADMIN ACCOUNT SETUP
-- Run AFTER creating the admin user in Firebase Console:
--   Firebase Console → Authentication → Users → Add User
--   Email: admin@eduai.pk  Password: (your chosen password)
--   Copy the UID that appears
-- ================================================================

-- 6. Insert admin profile
--    ⚠️  Replace 'PASTE_FIREBASE_UID_HERE' with the actual Firebase UID
--    ⚠️  Replace 'admin@eduai.pk' with the email you used in Firebase

INSERT INTO public.profiles (
  id,
  firebase_uid,
  email,
  full_name,
  role,
  created_at
)
VALUES (
  gen_random_uuid(),              -- internal UUID (auto-generated)
  'PASTE_FIREBASE_UID_HERE',      -- ← paste Firebase UID here
  'admin@eduai.pk',               -- ← same email as Firebase account
  'Platform Administrator',       -- display name
  'admin',
  NOW()
)
ON CONFLICT (firebase_uid)
DO UPDATE SET
  role      = 'admin',
  full_name = EXCLUDED.full_name,
  email     = EXCLUDED.email;

-- 7. Also add to admin_allowlist (if table exists from migration 0006)
INSERT INTO admin_allowlist (email, full_name)
VALUES ('admin@eduai.pk', 'Platform Administrator')
ON CONFLICT (email) DO NOTHING;

-- 8. Verify — run this to confirm setup
SELECT
  id,
  firebase_uid,
  email,
  full_name,
  role,
  created_at
FROM public.profiles
WHERE role = 'admin';
