import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getProfileFromRequest } from '../../lib/firebase/authHelper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Resolve student ID — from token (logged-in user) or query param
  const caller = await getProfileFromRequest(req, supabase);
  const studentId: string | null =
    (req.query.student_id as string) ||
    caller?.profileId ||
    null;

  if (!studentId) {
    // No identity at all — return empty shell so UI can show "no data" state
    return res.status(200).json({
      dashboard: { progress: [], recentQuizzes: [], recentNotes: [], weeklyActivity: [] }
    });
  }

  const [progressRes, quizzesRes, notesRes, flashcardsRes] = await Promise.allSettled([
    supabase
      .from('progress')
      .select('subject, mastery_percentage, weak_topics, updated_at')
      .eq('student_id', studentId)
      .order('updated_at', { ascending: false }),

    supabase
      .from('quizzes')
      .select('id, subject, topic, score, total_questions, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(6),

    supabase
      .from('notes')
      .select('id, subject, topic, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('flashcards')
      .select('subject, mastered')
      .eq('student_id', studentId),
  ]);

  const progress    = progressRes.status    === 'fulfilled' ? (progressRes.value.data    || []) : [];
  const quizzes     = quizzesRes.status     === 'fulfilled' ? (quizzesRes.value.data     || []) : [];
  const notes       = notesRes.status       === 'fulfilled' ? (notesRes.value.data       || []) : [];
  const flashcards  = flashcardsRes.status  === 'fulfilled' ? (flashcardsRes.value.data  || []) : [];

  // Build weekly activity chart from quiz history (last 7 quizzes as proxy)
  const weekDays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const activityMap: Record<string, number> = {};
  quizzes.forEach((q: any) => {
    const day = weekDays[new Date(q.created_at).getDay()];
    activityMap[day] = (activityMap[day] || 0) + 1;
  });
  const weeklyActivity = weekDays.map(d => ({ day: d, quizzes: activityMap[d] || 0 }));

  // Per-subject mastery from quiz scores (if progress table empty)
  const subjectMastery: Record<string, { total: number; count: number }> = {};
  quizzes.forEach((q: any) => {
    if (!q.subject || q.score == null || !q.total_questions) return;
    if (!subjectMastery[q.subject]) subjectMastery[q.subject] = { total: 0, count: 0 };
    subjectMastery[q.subject].total += (q.score / q.total_questions) * 100;
    subjectMastery[q.subject].count += 1;
  });

  const derivedProgress = progress.length > 0
    ? progress
    : Object.entries(subjectMastery).map(([subject, { total, count }]) => ({
        subject,
        mastery_percentage: Math.round(total / count),
        weak_topics: [],
      }));

  // Flashcard mastery
  const masteredCards = flashcards.filter((f: any) => f.mastered).length;

  return res.status(200).json({
    dashboard: {
      studentId,
      progress: derivedProgress,
      recentQuizzes: quizzes,
      recentNotes: notes,
      weeklyActivity,
      masteredCards,
      totalCards: flashcards.length,
      quizCount: quizzes.length,
      notesCount: notes.length,
    }
  });
}
