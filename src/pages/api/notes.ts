import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { generateNotes } from '../../lib/serverAI';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET — fetch existing notes (optional auth)
  if (req.method === 'GET') {
    const { student_id } = req.query;

    if (!student_id) {
      return res.status(200).json({ notes: [] });
    }

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('student_id', student_id as string)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ notes: data || [] });
    } catch (e: any) {
      console.error('[API/notes GET]', e.message);
      return res.status(200).json({ notes: [] });
    }
  }

  // POST — either AI generate or save existing notes
  if (req.method === 'POST') {
    const { generate, subject, topic, chapter, difficulty, language, student_id, content } = req.body;

    // AI generation mode
    if (generate) {
      if (!subject || !topic) {
        return res.status(400).json({ error: 'subject and topic are required' });
      }

      try {
        // Optionally fetch RAG context from library uploads
        let ragContext = '';
        if (subject && supabaseUrl) {
          try {
            const { data: libData } = await supabase
              .from('library_content')
              .select('extracted_text')
              .ilike('subject', `%${subject}%`)
              .limit(3);

            if (libData && libData.length > 0) {
              ragContext = libData
                .map((d: any) => d.extracted_text || '')
                .filter(Boolean)
                .join('\n\n')
                .slice(0, 3000);
            }
          } catch {
            // RAG context is optional — continue without it
          }
        }

        const markdown = await generateNotes({
          subject,
          topic,
          chapter: chapter || undefined,
          difficulty: difficulty || 'medium',
          language: language || 'EN',
          context: ragContext || undefined,
        });

        // Optionally persist if student_id provided
        if (student_id && supabaseUrl) {
          try {
            await supabase.from('notes').insert([{
              student_id,
              subject,
              topic,
              content: markdown,
            }]);
          } catch {
            // Persistence is best-effort
          }
        }

        return res.status(200).json({ notes: markdown, subject, topic });
      } catch (e: any) {
        console.error('[API/notes AI]', e.message);
        return res.status(500).json({ error: e.message || 'AI generation failed' });
      }
    }

    // Save mode — persist manually written notes
    if (!student_id || !subject || !topic || !content) {
      return res.status(400).json({ error: 'student_id, subject, topic, and content are required' });
    }

    try {
      const { data, error } = await supabase
        .from('notes')
        .insert([{ student_id, subject, topic, content }])
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ notes: data });
    } catch (e: any) {
      console.error('[API/notes POST]', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
