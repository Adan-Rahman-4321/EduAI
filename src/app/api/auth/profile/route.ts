import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminAuth } from '@/lib/firebase/admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    // Get Firebase ID token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const idToken = authHeader.substring(7);

    // Verify token with Firebase Admin
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (e: any) {
      console.error('[Profile API] Token verification failed:', e.message);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;

    // Fetch profile from Supabase
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Profile API] Database error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // If no profile exists, create one
    if (!profile) {
      const newProfile = {
        firebase_uid: firebaseUid,
        email: email || '',
        full_name: decodedToken.name || email?.split('@')[0] || 'User',
        role: 'student' // Default role
      };

      const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();

      if (createError) {
        console.error('[Profile API] Failed to create profile:', createError);
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
      }

      return NextResponse.json({ profile: created }, { status: 200 });
    }

    return NextResponse.json({ profile }, { status: 200 });

  } catch (e: any) {
    console.error('[Profile API] Unexpected error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
