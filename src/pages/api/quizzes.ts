import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { generateQuiz } from '../../lib/serverAI';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET — fetch saved quizzes (no auth required)
  if (req.method === 'GET') {
    const { student_id } = req.query;
    if (!student_id) return res.status(200).json({ quizzes: [] });

    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('student_id', student_id as string)
      .order('created_at', { ascending: false });

    if (error) return res.status(200).json({ quizzes: [] });
    return res.status(200).json({ quizzes: data || [] });
  }

  // POST — generate or save quiz
  if (req.method === 'POST') {
    const {
      student_id, subject, topic, content, score,
      total_questions, generate, questionCount,
      difficulty, questionType, language, context, weakAreas,
    } = req.body;

    if (!subject || !topic) {
      return res.status(400).json({ error: 'subject and topic are required' });
    }

    // ── AI Generation Mode ──
    if (generate === true) {
      try {
        // Optionally fetch weak areas from DB
        let studentWeakAreas: string[] = weakAreas || [];
        if (student_id && studentWeakAreas.length === 0 && supabaseUrl) {
          const { data: pd } = await supabase
            .from('student_progress')
            .select('weak_topics')
            .eq('student_id', student_id)
            .eq('subject', subject)
            .maybeSingle();
          studentWeakAreas = pd?.weak_topics || [];
        }

        const questions = await generateQuiz({
          subject,
          topic,
          questionCount: Math.min(questionCount || 8, 8), // cap at 8 to avoid token truncation
          difficulty: difficulty || 'medium',
          questionType: questionType || 'mcq',
          language: language || 'EN',
          context: context || undefined,
          studentWeakAreas,
        });

        // Best-effort save — don't fail if DB insert fails
        if (student_id && supabaseUrl) {
          await supabase.from('quizzes').insert([{
            student_id,
            subject,
            topic,
            content: JSON.stringify(questions),
            score: null,
            total_questions: questions.length,
          }]).then(() => {}, () => {});
        }

        return res.status(200).json({ questions, generated: true });
      } catch (e: any) {
        console.error('[API/quizzes AI]', e.message);
        return res.status(500).json({ error: e.message || 'AI generation failed' });
      }
    }

    // ── Manual save mode ──
    if (!content) return res.status(400).json({ error: 'content is required for manual quiz creation' });
    if (!student_id) return res.status(400).json({ error: 'student_id is required' });

    const { data, error } = await supabase
      .from('quizzes')
      .insert([{ student_id, subject, topic, content, score, total_questions }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ quiz: data });
  }

  // PATCH — update score
  if (req.method === 'PATCH') {
    const { id, score } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const { data, error } = await supabase
      .from('quizzes')
      .update({ score })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ quiz: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
