/**
 * Server-side Firebase token verifier for Pages Router API routes.
 * Returns the decoded UID or null if token is missing/invalid.
 */
import type { NextApiRequest } from 'next';
import { adminAuth } from './admin';

export async function getUidFromRequest(req: NextApiRequest): Promise<string | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth.slice(7));
    return decoded.uid;
  } catch {
    return null;
  }
}

/** Get both uid AND supabase profile id for the caller */
export async function getProfileFromRequest(
  req: NextApiRequest,
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient>
): Promise<{ uid: string; profileId: string | null; role: string | null; email: string | null } | null> {
  const uid = await getUidFromRequest(req);
  if (!uid) return null;

  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('firebase_uid', uid)
      .maybeSingle();

    return {
      uid,
      profileId: data?.id ?? null,
      role: data?.role ?? null,
      email: data?.email ?? null,
    };
  } catch {
    return { uid, profileId: null, role: null, email: null };
  }
}
