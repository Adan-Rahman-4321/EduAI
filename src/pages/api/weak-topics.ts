import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getProfileFromRequest } from '../../lib/firebase/authHelper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const caller = await getProfileFromRequest(req, supabase);
  const teacherProfileId = caller?.profileId;

  const { student_id } = req.query;

  // ── Fetch quiz performance for all students (or one specific student) ──────
  let quizQuery = supabase
    .from('quizzes')
    .select('student_id, subject, score, total_questions, profiles:student_id(full_name)')
    .not('score', 'is', null);

  if (student_id) quizQuery = quizQuery.eq('student_id', student_id as string);

  // If teacher, optionally filter by their own students (via assignments)
  // For now, show all students — teacher sees class-wide view
  const { data: quizData, error } = await quizQuery;
  if (error) return res.status(500).json({ error: error.message });

  // ── Also fetch progress table weak_topics ─────────────────────────────────
  const { data: progressData } = await supabase
    .from('progress')
    .select('student_id, subject, mastery_percentage, weak_topics, profiles:student_id(full_name)');

  // ── Build alerts ───────────────────────────────────────────────────────────
  const alerts: { type: 'critical' | 'warning'; message: string }[] = [];
  const weakTopicCounts: Record<string, number> = {};

  // From progress table
  progressData?.forEach((item: any) => {
    const name = Array.isArray(item.profiles) ? item.profiles[0]?.full_name : item.profiles?.full_name;
    const studentName = name || 'A student';

    if (item.mastery_percentage != null && item.mastery_percentage < 50) {
      alerts.push({
        type: 'critical',
        message: `${studentName}'s mastery in ${item.subject} is ${item.mastery_percentage}% — below threshold.`,
      });
    }

    const topics = Array.isArray(item.weak_topics) ? item.weak_topics : [];
    topics.forEach((t: string) => {
      weakTopicCounts[t] = (weakTopicCounts[t] || 0) + 1;
    });
  });

  // From quiz scores
  const studentQuizScores: Record<string, { name: string; scores: number[] }> = {};
  quizData?.forEach((q: any) => {
    if (!q.student_id || q.total_questions == null || q.total_questions === 0) return;
    const pct = (q.score / q.total_questions) * 100;
    const name = Array.isArray(q.profiles) ? q.profiles[0]?.full_name : q.profiles?.full_name;
    if (!studentQuizScores[q.student_id]) {
      studentQuizScores[q.student_id] = { name: name || 'Student', scores: [] };
    }
    studentQuizScores[q.student_id].scores.push(pct);
  });

  Object.entries(studentQuizScores).forEach(([, { name, scores }]) => {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < 50) {
      alerts.push({
        type: 'critical',
        message: `${name}'s average quiz score is ${Math.round(avg)}% — needs intervention.`,
      });
    }
  });

  // Aggregate weak topic warnings
  Object.entries(weakTopicCounts).forEach(([topic, count]) => {
    if (count >= 2) {
      alerts.push({
        type: 'warning',
        message: `${count} students are struggling with "${topic}".`,
      });
    }
  });

  // Deduplicate alerts
  const seen = new Set<string>();
  const uniqueAlerts = alerts.filter(a => {
    if (seen.has(a.message)) return false;
    seen.add(a.message);
    return true;
  });

  // ── Build student roster with mastery ──────────────────────────────────────
  const rosterMap: Record<string, { id: string; name: string; subject: string; mastery: number; weakTopic: string }[]> = {};

  progressData?.forEach((item: any) => {
    const id = item.student_id;
    const name = Array.isArray(item.profiles) ? item.profiles[0]?.full_name : item.profiles?.full_name;
    if (!rosterMap[id]) rosterMap[id] = [];
    rosterMap[id].push({
      id,
      name: name || 'Student',
      subject: item.subject,
      mastery: item.mastery_percentage ?? 0,
      weakTopic: Array.isArray(item.weak_topics) && item.weak_topics.length > 0
        ? item.weak_topics[0]
        : 'None',
    });
  });

  // Aggregate per student (use lowest mastery subject as the displayed row)
  const students = Object.entries(rosterMap).map(([id, rows]) => {
    const lowest = rows.sort((a, b) => a.mastery - b.mastery)[0];
    return {
      id,
      name: lowest.name,
      mastery: Math.round(rows.reduce((s, r) => s + r.mastery, 0) / rows.length),
      weakTopic: lowest.weakTopic,
      subjects: rows.map(r => ({ subject: r.subject, mastery: r.mastery })),
    };
  });

  return res.status(200).json({
    alerts: uniqueAlerts.slice(0, 10),
    weakTopicCounts,
    students,
    hasData: students.length > 0 || uniqueAlerts.length > 0,
  });
}
