import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { generateFlashcards } from '../../lib/serverAI';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET — fetch flashcards (no auth required)
  if (req.method === 'GET') {
    const { student_id, subject } = req.query;

    if (!supabaseUrl) return res.status(200).json({ flashcards: [] });

    try {
      let query = supabase.from('flashcards').select('*').order('created_at', { ascending: true });
      if (student_id) query = query.or(`student_id.eq.${student_id},student_id.is.null`);
      if (subject) query = query.eq('subject', subject as string);

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json({ flashcards: data || [] });
    } catch {
      return res.status(200).json({ flashcards: [] });
    }
  }

  // POST — generate or create/update
  if (req.method === 'POST') {
    const {
      id, student_id, subject, topic,
      front_en, back_en, front_ur, back_ur,
      mastered, generate, count, difficulty, language, context,
    } = req.body;

    // Update mastery on existing card
    if (id) {
      if (!supabaseUrl) return res.status(200).json({ ok: true });
      const { data, error } = await supabase
        .from('flashcards')
        .update({ mastered })
        .eq('id', id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ flashcard: data });
    }

    // ── AI Generation Mode ──
    if (generate === true) {
      if (!subject || !topic) {
        return res.status(400).json({ error: 'subject and topic are required' });
      }

      try {
        const flashcards = await generateFlashcards({
          subject,
          topic,
          count: count || 10,
          difficulty: difficulty || 'medium',
          language: language || 'EN',
          context: context || undefined,
        });

        // Best-effort DB save
        if (supabaseUrl) {
          const inserts = flashcards.map(card => ({
            student_id: student_id || null,
            subject,
            topic,
            front_en: card.front_en,
            back_en: card.back_en,
            front_ur: card.front_ur || null,
            back_ur: card.back_ur || null,
            mastered: false,
          }));
          await supabase.from('flashcards').insert(inserts).then(() => {}, () => {});
        }

        return res.status(200).json({ flashcards, generated: true });
      } catch (e: any) {
        console.error('[API/flashcards AI]', e.message);
        return res.status(500).json({ error: e.message || 'AI generation failed' });
      }
    }

    // ── Manual creation ──
    if (!subject || !topic || !front_en || !back_en) {
      return res.status(400).json({ error: 'subject, topic, front_en, and back_en are required' });
    }
    if (!supabaseUrl) return res.status(503).json({ error: 'Database not configured' });

    const { data, error } = await supabase
      .from('flashcards')
      .insert([{ student_id, subject, topic, front_en, back_en, front_ur, back_ur, mastered: false }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ flashcard: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
