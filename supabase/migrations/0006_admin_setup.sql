-- ================================================================
-- EduAI: Admin Credentials Setup
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ================================================================

-- 1. Ensure the profiles table has an is_admin flag
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. Create a secure admin_allowlist table
--    Only emails in this table can be assigned the admin role.
CREATE TABLE IF NOT EXISTS admin_allowlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT,
  added_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Insert your admin credentials
--    Replace with your actual admin email
INSERT INTO admin_allowlist (email, full_name)
VALUES
  ('admin@eduai.com', 'EduAI Administrator'),
  ('adan@eduai.com',  'Adan Rahman')
ON CONFLICT (email) DO NOTHING;

-- 4. If the admin already signed up via Firebase, promote them
UPDATE profiles
SET role = 'admin', is_admin = TRUE
WHERE email IN (
  SELECT email FROM admin_allowlist
);

-- 5. RLS: only service_role can read admin_allowlist
ALTER TABLE admin_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON admin_allowlist
  FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Verify: show current admin_allowlist
SELECT * FROM admin_allowlist;
SELECT id, full_name, email, role, is_admin FROM profiles WHERE role = 'admin';
