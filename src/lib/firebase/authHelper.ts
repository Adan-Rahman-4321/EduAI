/**
 * Server-side Firebase token helper for Pages Router API routes.
 * profiles.id is BIGINT IDENTITY — we use firebase_uid as the lookup key.
 */
import type { NextApiRequest } from 'next';
import { adminAuth } from './admin';

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

export interface CallerProfile {
  uid: string;
  profileId: string | null;   // BIGINT returned as string from Supabase JS
  role: string | null;
  email: string | null;
}

/**
 * Verifies Firebase token and fetches the matching profiles row.
 * Looks up by firebase_uid column (TEXT UNIQUE).
 * supabase: any avoids SupabaseClient generic mismatch on Vercel.
 */
export async function getProfileFromRequest(
  req: NextApiRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<CallerProfile | null> {
  const uid = await getUidFromRequest(req);
  if (!uid) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('firebase_uid', uid)
      .maybeSingle();

    const row = result?.data as { id: number | string; role: string; email: string } | null;

    return {
      uid,
      profileId: row?.id != null ? String(row.id) : null,
      role:      row?.role  ?? null,
      email:     row?.email ?? null,
    };
  } catch {
    return { uid, profileId: null, role: null, email: null };
  }
}
