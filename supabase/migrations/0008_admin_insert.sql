-- ================================================================
-- EduAI: Admin Account Insert
-- Firebase Auth use ho rahi hai, Supabase sirf database hai.
-- Password FIREBASE mein store hota hai, yahan sirf profile row.
--
-- STEPS:
--   1. Firebase Console → edu-ai-85a58 → Authentication
--      → Users → Add User
--      Email:    admin@eduai.pk
--      Password: (apni marzi ka — yahi login mein use hoga)
--      → User create hone ke baad UID copy karo
--      (jaise: abc123XYZdef456...)
--
--   2. Neeche PASTE_FIREBASE_UID_HERE ki jagah woh UID paste karo
--
--   3. Supabase Dashboard → SQL Editor → New Query → Run
-- ================================================================

-- Admin profile insert karo
-- (profiles.id BIGINT IDENTITY hai — auto assign hoga)
INSERT INTO public.profiles (
  firebase_uid,
  email,
  full_name,
  role
)
VALUES (
  'PASTE_FIREBASE_UID_HERE',   -- ← Firebase Console se copy karo
  'admin@eduai.pk',            -- ← wahi email jo Firebase mein di
  'Platform Administrator',    -- ← display name (badal sakte ho)
  'admin'
)
ON CONFLICT (firebase_uid)
DO UPDATE SET
  role      = 'admin',
  email     = EXCLUDED.email,
  full_name = EXCLUDED.full_name;

-- Verify — yeh row dikhna chahiye role = admin ke sath
SELECT id, firebase_uid, email, full_name, role
FROM public.profiles
WHERE role = 'admin';
