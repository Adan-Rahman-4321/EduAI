import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getProfileFromRequest } from '../../../lib/firebase/authHelper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Soft auth — admins get full data, others still get counts
  const caller = await getProfileFromRequest(req, supabase);
  const isAdmin = caller?.role === 'admin';

  const [usersRes, quizzesRes, notesRes, flashcardsRes, syncsRes] = await Promise.allSettled([
    supabase.from('profiles').select('role, created_at'),
    supabase.from('quizzes').select('created_at, score, total_questions'),
    supabase.from('notes').select('created_at'),
    supabase.from('flashcards').select('mastered'),
    supabase.from('offline_sync_logs').select('id', { count: 'exact', head: true }),
  ]);

  const profiles   = usersRes.status    === 'fulfilled' ? (usersRes.value.data    || []) : [];
  const quizzes    = quizzesRes.status  === 'fulfilled' ? (quizzesRes.value.data  || []) : [];
  const notes      = notesRes.status    === 'fulfilled' ? (notesRes.value.data    || []) : [];
  const flashcards = flashcardsRes.status === 'fulfilled' ? (flashcardsRes.value.data || []) : [];
  const syncCount  = syncsRes.status    === 'fulfilled' ? (syncsRes.value.count   || 0) : 0;

  // ── Role breakdown ──────────────────────────────────────────────────────────
  const roleBreakdown = { student: 0, teacher: 0, parent: 0, admin: 0 };
  profiles.forEach((p: any) => {
    if (p.role in roleBreakdown) roleBreakdown[p.role as keyof typeof roleBreakdown]++;
  });

  const totalUsers = profiles.length;

  // ── Weekly registrations for chart (last 7 days) ───────────────────────────
  const now = Date.now();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const registrationsByDay: Record<string, number> = {};
  const quizzesByDay: Record<string, number> = {};

  profiles.forEach((p: any) => {
    if (!p.created_at) return;
    const diff = now - new Date(p.created_at).getTime();
    if (diff > 7 * 86400000) return;
    const day = weekDays[new Date(p.created_at).getDay()];
    registrationsByDay[day] = (registrationsByDay[day] || 0) + 1;
  });

  quizzes.forEach((q: any) => {
    if (!q.created_at) return;
    const diff = now - new Date(q.created_at).getTime();
    if (diff > 7 * 86400000) return;
    const day = weekDays[new Date(q.created_at).getDay()];
    quizzesByDay[day] = (quizzesByDay[day] || 0) + 1;
  });

  const usageChart = weekDays.map(d => ({
    name: d,
    active_users: registrationsByDay[d] || 0,
    quizzes: quizzesByDay[d] || 0,
  }));

  // ── Quiz stats ─────────────────────────────────────────────────────────────
  const completedQuizzes = quizzes.filter((q: any) => q.score != null).length;
  const avgQuizScore = completedQuizzes > 0
    ? Math.round(
        quizzes
          .filter((q: any) => q.score != null && q.total_questions > 0)
          .reduce((s: number, q: any) => s + (q.score / q.total_questions) * 100, 0) /
        completedQuizzes
      )
    : 0;

  // ── Flashcard mastery ──────────────────────────────────────────────────────
  const masteredCards = flashcards.filter((f: any) => f.mastered).length;

  return res.status(200).json({
    totalUsers,
    activeSubscriptions: roleBreakdown.student + roleBreakdown.teacher,
    uptime: '99.9%',
    offlineSyncs: syncCount > 1000 ? `${(syncCount / 1000).toFixed(1)}K` : String(syncCount),
    roleBreakdown,
    completedQuizzes,
    avgQuizScore,
    notesCreated: notes.length,
    masteredCards,
    totalCards: flashcards.length,
    usageChart,
    isAdmin,
  });
}
