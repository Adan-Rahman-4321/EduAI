import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getProfileFromRequest } from '../../lib/firebase/authHelper';
import { generateAssignment } from '../../lib/serverAI';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET — fetch assignments (public read for teachers/students)
  if (req.method === 'GET') {
    const { teacher_id, subject, limit: lim } = req.query;
    const pageLimit = Math.min(parseInt(lim as string) || 20, 100);

    let query = supabase
      .from('assignments')
      .select('id, title, subject, description, due_date, type, teacher_id, created_at')
      .order('created_at', { ascending: false })
      .limit(pageLimit);

    if (teacher_id) query = query.eq('teacher_id', teacher_id as string);
    if (subject)    query = query.eq('subject', subject as string);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ assignments: data || [] });
  }

  // POST — create or AI-generate assignment (teacher)
  if (req.method === 'POST') {
    const caller = await getProfileFromRequest(req, supabase);
    const { title, subject, description, due_date, type, generate, topic, difficulty, language, context } = req.body;

    if (!title || !subject || !type) {
      return res.status(400).json({ error: 'title, subject, and type are required' });
    }

    const teacherId = caller?.profileId || 'demo-teacher';

    // ── AI generation ─────────────────────────────────────────────────────────
    if (generate === true) {
      if (!topic) return res.status(400).json({ error: 'topic is required for AI generation' });

      try {
        const generatedContent = await generateAssignment({
          subject,
          topic,
          type: type as 'essay' | 'mcq' | 'short-answer' | 'practical',
          difficulty: difficulty || 'medium',
          language: language || 'EN',
          context: context || undefined,
        });

        const fullDescription = description
          ? `${description}\n\n---\n\n${generatedContent}`
          : generatedContent;

        const { data, error } = await supabase
          .from('assignments')
          .insert([{ teacher_id: teacherId, title, subject, description: fullDescription, due_date, type }])
          .select()
          .single();

        if (error) {
          // Return the content even if DB save fails
          return res.status(200).json({
            assignment: { id: String(Date.now()), teacher_id: teacherId, title, subject, description: fullDescription, due_date, type },
            generated: true,
          });
        }
        return res.status(201).json({ assignment: data, generated: true });
      } catch (e: any) {
        return res.status(500).json({ error: e.message || 'AI generation failed' });
      }
    }

    // ── Manual creation ────────────────────────────────────────────────────────
    const { data, error } = await supabase
      .from('assignments')
      .insert([{ teacher_id: teacherId, title, subject, description, due_date, type }])
      .select()
      .single();

    if (error) {
      // Best-effort: return local object if DB fails
      return res.status(200).json({
        assignment: { id: String(Date.now()), teacher_id: teacherId, title, subject, description, due_date, type },
      });
    }
    return res.status(201).json({ assignment: data });
  }

  // DELETE
  if (req.method === 'DELETE') {
    const caller = await getProfileFromRequest(req, supabase);
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
