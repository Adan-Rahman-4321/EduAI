/**
 * Server-side Firebase token verifier for Pages Router API routes.
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

/** Get uid + supabase profile for the caller */
export async function getProfileFromRequest(
  req: NextApiRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ uid: string; profileId: string | null; role: string | null; email: string | null } | null> {
  const uid = await getUidFromRequest(req);
  if (!uid) return null;

  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('firebase_uid', uid)
      .maybeSingle();

    const row = data as { id: string; role: string; email: string } | null;
    return {
      uid,
      profileId: row?.id ?? null,
      role:      row?.role ?? null,
      email:     row?.email ?? null,
    };
  } catch {
    return { uid, profileId: null, role: null, email: null };
  }
}
