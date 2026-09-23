'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Cell,
} from 'recharts';
import {
  Timer, Zap, BookOpen, Clock, CalendarDays, CheckCircle2,
  X, Play, Loader2, Brain, FileText, AlertCircle,
} from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { auth } from '@/lib/firebase/config';

type TaskStatus = 'completed' | 'current' | 'upcoming';
interface PlanTask {
  id: string;
  time: string;
  title: string;
  subject: string;
  status: TaskStatus;
  description: string;
}

interface DashData {
  studentId: string;
  progress: { subject: string; mastery_percentage: number }[];
  recentQuizzes: { id: string; subject: string; topic: string; score: number; total_questions: number; created_at: string }[];
  recentNotes: { id: string; subject: string; topic: string; created_at: string }[];
  weeklyActivity: { day: string; quizzes: number }[];
  masteredCards: number;
  totalCards: number;
  quizCount: number;
  notesCount: number;
}

function scoreColor(pct: number) {
  if (pct >= 75) return '#10b981';
  if (pct >= 55) return '#0ea5e9';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}

export default function StudentDashboard({ language }: { language: 'EN' | 'UR' }) {
  const isUrdu = language === 'UR';
  const { profile } = useUserProfile();
  const displayName = profile?.full_name || (isUrdu ? 'طالب علم' : 'Student');

  const [dash, setDash] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<PlanTask | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);

  // ── Fetch real dashboard data ─────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const user = auth.currentUser;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (user) headers['Authorization'] = `Bearer ${await user.getIdToken()}`;

        const [dashRes, planRes] = await Promise.allSettled([
          fetch('/api/dashboard', { headers }),
          fetch('/api/study-planner', { headers }),
        ]);

        if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
          const d = await dashRes.value.json();
          if (mounted) setDash(d.dashboard);
        }

        if (planRes.status === 'fulfilled' && planRes.value.ok) {
          const p = await planRes.value.json();
          if (mounted && p.plan?.tasks?.length > 0) setTasks(p.plan.tasks);
        }
      } catch (e) {
        console.error('[StudentDashboard]', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // ── Generate tomorrow's plan ───────────────────────────────────────────────
  const handleGeneratePlan = async () => {
    if (!dash) return;
    setIsGeneratingPlan(true);

    // Build tasks from real weak subjects
    const weakSubjects = [...dash.progress]
      .sort((a, b) => a.mastery_percentage - b.mastery_percentage)
      .slice(0, 3);

    const newTasks: PlanTask[] = [
      ...weakSubjects.map((s, i) => ({
        id: `plan-${Date.now()}-${i}`,
        time: ['09:00 AM', '11:00 AM', '02:00 PM'][i] || '04:00 PM',
        title: `Review ${s.subject} — Mastery ${s.mastery_percentage}%`,
        subject: s.subject,
        status: i === 0 ? ('current' as TaskStatus) : ('upcoming' as TaskStatus),
        description: `Focus on improving your ${s.subject} mastery from ${s.mastery_percentage}% to at least 75% with the AI Tutor.`,
      })),
    ];

    if (newTasks.length === 0) {
      newTasks.push({
        id: `plan-${Date.now()}`,
        time: '09:00 AM',
        title: 'Take a practice quiz',
        subject: 'General',
        status: 'current',
        description: 'No weak topics detected — keep momentum with a daily quiz!',
      });
    }

    try {
      const user = auth.currentUser;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user) headers['Authorization'] = `Bearer ${await user.getIdToken()}`;
      await fetch('/api/study-planner', {
        method: 'POST',
        headers,
        body: JSON.stringify({ tasks: newTasks }),
      });
    } catch { /* best-effort */ }

    setTasks(newTasks);
    setIsGeneratingPlan(false);
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const overallMastery = dash?.progress?.length
    ? Math.round(dash.progress.reduce((s, p) => s + p.mastery_percentage, 0) / dash.progress.length)
    : 0;

  const masteryPct = dash?.totalCards
    ? Math.round(((dash.masteredCards || 0) / dash.totalCards) * 100)
    : 0;

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-6 w-full animate-pulse">
        <div className="h-10 w-72 bg-slate-800 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl" />)}
        </div>
        <div className="h-64 bg-slate-800 rounded-xl" />
      </div>
    );
  }

  const hasData = !!dash && (dash.progress.length > 0 || dash.quizCount > 0);

  return (
    <div className="flex flex-col gap-6 w-full overflow-y-auto scrollbar-hide relative pb-8">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold text-white ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu ? `خوش آمدید، ${displayName}!` : `Welcome back, ${displayName}!`}
          </h1>
          <p className={`text-slate-400 mt-1 text-sm ${isUrdu ? 'font-urdu' : ''}`}>
            {hasData
              ? (isUrdu ? 'آپ کا ڈیٹا لوڈ ہو گیا ہے۔' : 'Your real-time learning data is ready.')
              : (isUrdu ? 'ابھی کوئی ڈیٹا نہیں — کوئز دیں یا نوٹس بنائیں!' : 'No data yet — take a quiz or create notes to get started!')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600/20 to-blue-600/20 border border-sky-500/30 flex items-center gap-2">
            <Timer className="w-5 h-5 text-sky-400" />
            <div className="flex flex-col">
              <span className="text-xs text-sky-200 uppercase font-semibold">FBISE Matric</span>
              <CountdownTimer />
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sky-400">
            <BookOpen className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">{isUrdu ? 'مہارت' : 'Mastery'}</span>
          </div>
          <span className="text-3xl font-bold text-white">
            {overallMastery}<span className="text-base text-slate-400">%</span>
          </span>
        </div>

        <div className="glass-card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-purple-400">
            <Brain className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">{isUrdu ? 'کوئز' : 'Quizzes'}</span>
          </div>
          <span className="text-3xl font-bold text-white">{dash?.quizCount ?? 0}</span>
        </div>

        <div className="glass-card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">{isUrdu ? 'نوٹس' : 'Notes'}</span>
          </div>
          <span className="text-3xl font-bold text-white">{dash?.notesCount ?? 0}</span>
        </div>

        <button
          onClick={() => setShowQuizModal(true)}
          className="glass-card p-4 flex flex-col gap-2 text-left hover:scale-[1.02] active:scale-95 transition-transform relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-sky-500/10 group-hover:bg-sky-500/20 transition-colors" />
          <div className="relative z-10 flex flex-col justify-center h-full items-center text-center w-full">
            <span className="font-bold text-sky-300 text-sm">{isUrdu ? 'آج کا کوئز' : 'Take Daily Quiz'}</span>
            <span className="text-xs text-slate-400 mt-1">+50 XP</span>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Charts ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Subject Mastery Bar Chart */}
          {dash?.progress && dash.progress.length > 0 ? (
            <div className="glass-card p-6">
              <h3 className={`font-semibold text-slate-200 mb-4 flex items-center gap-2 ${isUrdu ? 'font-urdu flex-row-reverse' : ''}`}>
                <Zap className="w-5 h-5 text-sky-400" />
                {isUrdu ? 'مضمون کے مطابق مہارت' : 'Subject Mastery'}
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dash.progress} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="subject" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v: any) => [`${v}%`, 'Mastery']}
                  />
                  <Bar dataKey="mastery_percentage" radius={[6, 6, 0, 0]}>
                    {dash.progress.map((entry, i) => (
                      <Cell key={i} fill={scoreColor(entry.mastery_percentage)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="glass-card p-6 flex flex-col items-center justify-center gap-3 min-h-[220px]">
              <AlertCircle className="w-10 h-10 text-slate-600" />
              <p className="text-slate-400 text-sm text-center">
                {isUrdu ? 'کوئی مہارت ڈیٹا نہیں — کوئز دیں!' : 'No mastery data yet — take a quiz to get started!'}
              </p>
            </div>
          )}

          {/* Weekly Quiz Activity */}
          {dash?.weeklyActivity && dash.weeklyActivity.some(d => d.quizzes > 0) ? (
            <div className="glass-card p-6">
              <h3 className={`font-semibold text-slate-200 mb-4 flex items-center gap-2 ${isUrdu ? 'font-urdu flex-row-reverse' : ''}`}>
                <CalendarDays className="w-5 h-5 text-purple-400" />
                {isUrdu ? 'ہفتہ وار سرگرمی' : 'Weekly Quiz Activity'}
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={dash.weeklyActivity} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v: any) => [v, 'Quizzes']}
                  />
                  <Line type="monotone" dataKey="quizzes" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          {/* Recent Quizzes */}
          {dash?.recentQuizzes && dash.recentQuizzes.length > 0 && (
            <div className="glass-card p-6">
              <h3 className={`font-semibold text-slate-200 mb-4 ${isUrdu ? 'font-urdu text-right' : ''}`}>
                {isUrdu ? 'حالیہ کوئز' : 'Recent Quizzes'}
              </h3>
              <div className="flex flex-col gap-2">
                {dash.recentQuizzes.slice(0, 5).map((q) => {
                  const pct = q.total_questions > 0 ? Math.round((q.score / q.total_questions) * 100) : 0;
                  return (
                    <div key={q.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                      <div>
                        <p className="text-sm font-medium text-slate-200">{q.subject}: {q.topic}</p>
                        <p className="text-xs text-slate-500">{new Date(q.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: scoreColor(pct) }}>{pct}%</span>
                        <span className="text-xs text-slate-500">{q.score}/{q.total_questions}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Planner ── */}
        <div className="glass-card p-6 flex flex-col h-full relative overflow-hidden">
          <div className="absolute top-0 right-0 p-32 bg-sky-500/10 blur-[100px] rounded-full -z-10 pointer-events-none" />

          <div className="flex items-center justify-between mb-5">
            <h3 className={`font-semibold text-slate-200 flex items-center gap-2 ${isUrdu ? 'font-urdu flex-row-reverse' : ''}`}>
              <CalendarDays className="w-5 h-5 text-purple-400" />
              {isUrdu ? 'پلانر' : 'Study Planner'}
            </h3>
            <span className="text-xs px-2 py-1 bg-sky-500/20 text-sky-300 rounded-full border border-sky-500/30">
              AI
            </span>
          </div>

          {tasks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <Clock className="w-10 h-10 text-slate-600" />
              <p className="text-slate-400 text-sm">
                {isUrdu ? 'پلان بنانے کے لیے نیچے کلک کریں' : 'Click below to generate your study plan'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 flex-1 overflow-y-auto scrollbar-hide">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`p-4 rounded-xl border flex gap-4 text-left transition-all hover:scale-[1.01] ${
                    task.status === 'completed'
                      ? 'bg-slate-800/30 border-slate-700/50 opacity-60 hover:opacity-100'
                      : task.status === 'current'
                      ? 'bg-sky-900/20 border-sky-500/40 hover:bg-sky-900/30'
                      : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <div className="mt-1 shrink-0">
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : task.status === 'current' ? (
                      <div className="w-5 h-5 rounded-full border-2 border-sky-400 flex items-center justify-center relative">
                        <div className="w-2.5 h-2.5 bg-sky-400 rounded-full" />
                        <div className="absolute inset-0 rounded-full border-2 border-sky-400 animate-ping opacity-75" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${task.status === 'current' ? 'text-sky-300' : 'text-slate-300'}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">{task.time}</span>
                      <span className="text-[10px] text-slate-600">•</span>
                      <span className="text-xs text-slate-400">{task.subject}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleGeneratePlan}
            disabled={isGeneratingPlan || !dash}
            className="w-full mt-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 transition-colors border border-slate-700 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isGeneratingPlan
              ? <><Loader2 className="w-4 h-4 animate-spin text-sky-400" />{isUrdu ? 'تیار ہو رہا ہے...' : 'Generating...'}</>
              : (isUrdu ? 'کل کا پلان بنائیں' : "Generate Tomorrow's Plan")}
          </button>
        </div>
      </div>

      {/* ── Flashcard mastery bar ── */}
      {dash && dash.totalCards > 0 && (
        <div className="glass-card p-5 flex items-center gap-4">
          <BookOpen className="w-5 h-5 text-fuchsia-400 shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
              <span>{isUrdu ? 'فلیش کارڈ مہارت' : 'Flashcard Mastery'}</span>
              <span>{dash.masteredCards}/{dash.totalCards} ({masteryPct}%)</span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-sky-500 transition-all duration-700" style={{ width: `${masteryPct}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Task Detail Modal ── */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setSelectedTask(null)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${selectedTask.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'}`}>
                {selectedTask.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <CalendarDays className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{selectedTask.subject}</p>
                <h3 className="text-lg font-bold text-white leading-tight mt-0.5">{selectedTask.title}</h3>
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">{selectedTask.description}</p>
            <div className="flex items-center justify-between mb-6 p-3 bg-slate-950/50 rounded-xl border border-slate-800">
              <div><p className="text-xs text-slate-500">{isUrdu ? 'وقت' : 'Scheduled'}</p><p className="text-sm font-medium text-slate-300">{selectedTask.time}</p></div>
              <div className="text-right"><p className="text-xs text-slate-500">Status</p><p className={`text-sm font-medium capitalize ${selectedTask.status === 'completed' ? 'text-emerald-400' : selectedTask.status === 'current' ? 'text-sky-400' : 'text-slate-400'}`}>{selectedTask.status}</p></div>
            </div>
            {selectedTask.status !== 'completed' && (
              <button onClick={() => setSelectedTask(null)} className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] flex items-center justify-center gap-2">
                <Play className="w-4 h-4 fill-current" /> {isUrdu ? 'ابھی شروع کریں' : 'Start Task Now'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Daily Quiz Modal ── */}
      {showQuizModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-sky-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{isUrdu ? 'آج کا کوئز' : 'Daily Quiz'}</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              {isUrdu
                ? '10 سوالوں کا adaptive کوئز آپ کی کمزور topics پر مبنی ہوگا۔'
                : 'A 10-question adaptive quiz based on your weakest topics. Takes ~15 minutes.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowQuizModal(false)} className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors border border-slate-700">
                {isUrdu ? 'بعد میں' : 'Not Now'}
              </button>
              <button onClick={() => setShowQuizModal(false)} className="flex-1 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] flex items-center justify-center gap-2">
                <Play className="w-4 h-4 fill-current" /> {isUrdu ? 'شروع' : "Let's Go"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Countdown to FBISE Matric (May 15 next year) */
function CountdownTimer() {
  const [label, setLabel] = useState('...');
  useEffect(() => {
    function calc() {
      const now = new Date();
      const exam = new Date(now.getFullYear(), 4, 15); // May 15
      if (exam <= now) exam.setFullYear(exam.getFullYear() + 1);
      const diff = exam.getTime() - now.getTime();
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLabel(`${d}d ${h}h ${m}m`);
    }
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono font-bold text-white leading-none text-sm">{label}</span>;
}
