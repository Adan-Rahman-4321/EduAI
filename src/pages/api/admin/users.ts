import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getProfileFromRequest } from '../../../lib/firebase/authHelper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET — list users (admin only in production, but no hard block for demo)
  if (req.method === 'GET') {
    const { role, search, limit: lim } = req.query;
    const pageLimit = Math.min(parseInt(lim as string) || 50, 200);

    let query = supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .order('created_at', { ascending: false })
      .limit(pageLimit);

    if (role && role !== 'all') query = query.eq('role', role as string);
    if (search) query = query.ilike('full_name', `%${search}%`);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ users: data || [] });
  }

  // POST — create a profile row (admin action)
  if (req.method === 'POST') {
    const caller = await getProfileFromRequest(req, supabase);
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { full_name, email, role } = req.body;
    if (!full_name || !role) return res.status(400).json({ error: 'full_name and role are required' });

    const { data, error } = await supabase
      .from('profiles')
      .insert([{ full_name, email: email || null, role, created_at: new Date().toISOString() }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ user: data });
  }

  // DELETE — remove profile (admin only)
  if (req.method === 'DELETE') {
    const caller = await getProfileFromRequest(req, supabase);
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
