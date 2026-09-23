/**
 * Server-side Firebase token helper for Pages Router API routes.
 * No Supabase dependency here — keeps types simple and avoids
 * SupabaseClient generic mismatches on Vercel strict TS build.
 */
import type { NextApiRequest } from 'next';
import { adminAuth } from './admin';

/** Returns the verified Firebase UID or null. */
export async function getUidFromRequest(req: NextApiRequest): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * Verifies token and looks up the Supabase profile row.
 * supabase typed as any to avoid SupabaseClient generic conflicts on Vercel.
 */
export async function getProfileFromRequest(
  req: NextApiRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{
  uid: string;
  profileId: string | null;
  role: string | null;
  email: string | null;
} | null> {
  const uid = await getUidFromRequest(req);
  if (!uid) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('firebase_uid', uid)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const row = result?.data as { id: string; role: string; email: string } | null;

    return {
      uid,
      profileId: row?.id    ?? null,
      role:      row?.role   ?? null,
      email:     row?.email  ?? null,
    };
  } catch {
    return { uid, profileId: null, role: null, email: null };
  }
}
