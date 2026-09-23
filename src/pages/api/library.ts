import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const mockLibrary = [
  { id: '1', title: 'Physics (Class 10)', board: 'PTB', size: '15 MB', type: 'book', file_url: '#', subject: 'Physics', grade: '10' },
  { id: '2', title: 'Mathematics (Class 10)', board: 'FBISE', size: '22 MB', type: 'book', file_url: '#', subject: 'Mathematics', grade: '10' },
  { id: '3', title: 'Chemistry (Class 10)', board: 'PTB', size: '18 MB', type: 'book', file_url: '#', subject: 'Chemistry', grade: '10' },
  { id: '4', title: 'Biology (Class 10)', board: 'PTB', size: '20 MB', type: 'book', file_url: '#', subject: 'Biology', grade: '10' },
  { id: '5', title: 'Urdu Grammar (Class 10)', board: 'FBISE', size: '8 MB', type: 'book', file_url: '#', subject: 'Urdu', grade: '10' },
  { id: '6', title: 'Past Paper 2024 (Physics)', board: 'FBISE', size: '2 MB', type: 'resource', file_url: '#', subject: 'Physics', grade: '10' },
  { id: '7', title: 'Past Paper 2024 (Math)', board: 'PTB', size: '3 MB', type: 'resource', file_url: '#', subject: 'Mathematics', grade: '10' },
  { id: '8', title: 'Past Paper 2024 (Chemistry)', board: 'FBISE', size: '2.5 MB', type: 'resource', file_url: '#', subject: 'Chemistry', grade: '10' },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET — public access, no auth required
  if (req.method === 'GET') {
    const { board, type, query, grade } = req.query;

    // Try database first
    if (supabaseUrl) {
      try {
        let dbQuery = supabase
          .from('digital_library')
          .select('*')
          .order('title', { ascending: true });

        if (board && board !== 'all') dbQuery = dbQuery.eq('board', board as string);
        if (type && type !== 'all') dbQuery = dbQuery.eq('type', type as string);
        if (grade) dbQuery = dbQuery.eq('grade', grade as string);
        if (query) dbQuery = dbQuery.ilike('title', `%${query}%`);

        const { data, error } = await dbQuery;

        if (!error && data && data.length > 0) {
          return res.status(200).json({ items: data });
        }
      } catch {
        // Fall through to mock data
      }
    }

    // Fallback: local mock data with filtering
    let filtered = [...mockLibrary];
    if (type && type !== 'all') filtered = filtered.filter(b => b.type === type);
    if (query) filtered = filtered.filter(b => b.title.toLowerCase().includes((query as string).toLowerCase()));
    if (grade) filtered = filtered.filter(b => b.grade === grade);

    return res.status(200).json({ items: filtered });
  }

  // POST — add a new resource (admin only in production)
  if (req.method === 'POST') {
    const { title, board, grade, subject, file_url, size, type } = req.body;

    if (!title || !board || !type) {
      return res.status(400).json({ error: 'title, board, and type are required' });
    }

    if (!supabaseUrl) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    try {
      const { data, error } = await supabase
        .from('digital_library')
        .insert([{
          title,
          board,
          grade: grade || '10',
          subject: subject || 'General',
          file_url: file_url || '#',
          size: size || '12 MB',
          type,
        }])
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ item: data });
    } catch (e: any) {
      console.error('[API/library POST]', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
