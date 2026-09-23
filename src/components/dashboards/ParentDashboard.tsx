'use client';

import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import {
  HeartHandshake, TrendingUp, Award, Calendar, FileText,
  Download, CheckCircle2, BookOpen, Brain, Loader2,
  AlertCircle, User, Sparkles, BarChart3,
} from 'lucide-react';
import { auth } from '@/lib/firebase/config';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardData {
  studentName: string;
  studentId: string;
  isDemo: boolean;
  attendanceRate: number;
  avgScore: number;
  grade: string;
  trendData: { week: string; score: number }[];
  subjectBreakdown: { subject: string; avgScore: number; quizCount: number }[];
  quizCount: number;
  notesCount: number;
  masteredCards: number;
  totalCards: number;
  masteryPct: number;
  summaryEn: string;
  summaryUr: string;
}

// ── PDF generator (client-only dynamic import) ───────────────────────────────
async function downloadPDF(data: DashboardData, language: 'EN' | 'UR') {
  const { jsPDF } = await import('jspdf');
  const autoTable  = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW  = doc.internal.pageSize.getWidth();
  const today  = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const isUrdu = language === 'UR';

  // ── Header band ───────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);          // slate-950
  doc.rect(0, 0, pageW, 36, 'F');

  doc.setFillColor(14, 165, 233);        // sky-500 accent strip
  doc.rect(0, 0, 4, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('EduAI', 12, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);       // slate-400
  doc.text('AI-Powered Education Platform', 12, 21);
  doc.text(`Student Progress Report  •  ${today}`, 12, 28);

  doc.setTextColor(14, 165, 233);
  doc.setFontSize(9);
  doc.text('CONFIDENTIAL', pageW - 14, 28, { align: 'right' });

  // ── Student info ──────────────────────────────────────────────────────────
  let y = 46;
  doc.setFillColor(30, 41, 59);          // slate-800
  doc.roundedRect(10, y, pageW - 20, 22, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(data.studentName, 16, y + 9);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Student ID: ${data.studentId}`, 16, y + 16);

  if (data.isDemo) {
    doc.setTextColor(251, 191, 36);
    doc.text('DEMO DATA — Link your child\'s account for live data', pageW - 14, y + 9, { align: 'right' });
  }

  // ── KPI cards ─────────────────────────────────────────────────────────────
  y += 30;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(226, 232, 240);
  doc.text('Performance Overview', 10, y);

  y += 6;
  const kpis = [
    { label: 'Avg. Score',   value: `${data.avgScore}%`, color: [14, 165, 233]  as [number,number,number] },
    { label: 'Grade',        value: data.grade,           color: [16, 185, 129] as [number,number,number] },
    { label: 'Attendance',   value: `${data.attendanceRate}%`, color: [168, 85, 247] as [number,number,number] },
    { label: 'Quiz Count',   value: String(data.quizCount),   color: [245, 158, 11]  as [number,number,number] },
  ];

  const kpiW = (pageW - 20 - 9) / 4;
  kpis.forEach((kpi, i) => {
    const x = 10 + i * (kpiW + 3);
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(x, y, kpiW, 22, 3, 3, 'F');
    doc.setFillColor(...kpi.color);
    doc.roundedRect(x, y, kpiW, 3, 1, 1, 'F');

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, x + kpiW / 2, y + 13, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(kpi.label, x + kpiW / 2, y + 19, { align: 'center' });
  });

  // ── AI Summary ────────────────────────────────────────────────────────────
  y += 30;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(226, 232, 240);
  doc.text('AI Executive Summary', 10, y);
  y += 5;

  doc.setFillColor(15, 23, 42);
  doc.setDrawColor(14, 165, 233);
  doc.setLineWidth(0.4);
  const summaryText = isUrdu ? data.summaryEn : data.summaryEn; // jsPDF has no Urdu font; always EN
  const summaryLines = doc.splitTextToSize(summaryText, pageW - 24);
  const summaryH = summaryLines.length * 5 + 8;
  doc.roundedRect(10, y, pageW - 20, summaryH, 3, 3, 'FD');
  doc.setTextColor(203, 213, 225);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(summaryLines, 14, y + 7);
  y += summaryH + 8;

  // ── Weekly trend table ────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(226, 232, 240);
  doc.text('Weekly Performance Trend', 10, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Week', 'Score (%)', 'Status']],
    body: data.trendData.map(t => [
      t.week,
      `${t.score}%`,
      t.score >= 75 ? '✓ Good' : t.score >= 60 ? '~ Average' : '✗ Needs Work',
    ]),
    styles: { fontSize: 9, cellPadding: 4, textColor: [203, 213, 225], fillColor: [30, 41, 59], lineColor: [51, 65, 85] },
    headStyles: { fillColor: [14, 165, 233], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [15, 23, 42] },
    columnStyles: { 2: { cellWidth: 40 } },
    margin: { left: 10, right: 10 },
  });

  // ── Subject breakdown ──────────────────────────────────────────────────────
  y = (doc as any).lastAutoTable.finalY + 8;
  if (y > 240) { doc.addPage(); y = 20; }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(226, 232, 240);
  doc.text('Subject-wise Performance', 10, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Subject', 'Avg. Score (%)', 'Quizzes Taken', 'Status']],
    body: data.subjectBreakdown.map(s => [
      s.subject,
      `${s.avgScore}%`,
      String(s.quizCount),
      s.avgScore >= 75 ? 'Strong' : s.avgScore >= 60 ? 'Moderate' : 'Needs Focus',
    ]),
    styles: { fontSize: 9, cellPadding: 4, textColor: [203, 213, 225], fillColor: [30, 41, 59], lineColor: [51, 65, 85] },
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [15, 23, 42] },
    margin: { left: 10, right: 10 },
  });

  // ── Flashcard & Notes summary ──────────────────────────────────────────────
  y = (doc as any).lastAutoTable.finalY + 8;
  if (y > 255) { doc.addPage(); y = 20; }

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Flashcards Mastered', `${data.masteredCards} / ${data.totalCards} (${data.masteryPct}%)`],
      ['Study Notes Created', String(data.notesCount)],
      ['Attendance Rate', `${data.attendanceRate}%`],
    ],
    styles: { fontSize: 9, cellPadding: 4, textColor: [203, 213, 225], fillColor: [30, 41, 59], lineColor: [51, 65, 85] },
    headStyles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [15, 23, 42] },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 10, right: 10 },
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 284, pageW, 14, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`EduAI Platform  •  Generated ${today}  •  Confidential`, 10, 292);
    doc.text(`Page ${i} of ${pageCount}`, pageW - 10, 292, { align: 'right' });
  }

  doc.save(`EduAI_Report_${data.studentName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ── Score colour helper ────────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 75) return '#10b981';  // emerald
  if (score >= 60) return '#f59e0b';  // amber
  return '#ef4444';                   // red
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ParentDashboard({ language }: { language: 'EN' | 'UR' }) {
  const isUrdu = language === 'UR';

  const [data, setData]         = useState<DashboardData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const user = auth.currentUser;
        const headers: Record<string, string> = {};
        if (user) {
          const token = await user.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch('/api/parent-dashboard', { headers });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleDownload = async () => {
    if (!data) return;
    setPdfLoading(true);
    try {
      await downloadPDF(data, language);
    } catch (e: any) {
      console.error('[PDF]', e.message);
    } finally {
      setPdfLoading(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-slate-400 space-y-2">
          <AlertCircle className="w-10 h-10 mx-auto text-red-400" />
          <p className="text-white font-semibold">{isUrdu ? 'ڈیٹا لوڈ نہیں ہوا' : 'Failed to load data'}</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const childName = data.studentName;

  return (
    <div className="flex flex-col gap-6 w-full overflow-y-auto scrollbar-hide pb-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <HeartHandshake className="w-5 h-5" />
            <span className="font-semibold uppercase tracking-wider text-xs">Parent Portal</span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-bold text-white ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu ? `${childName} کی کارکردگی` : `${childName}'s Progress Report`}
          </h1>
          {data.isDemo && (
            <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {isUrdu ? 'ڈیمو ڈیٹا — اپنے بچے کا اکاؤنٹ لنک کریں' : 'Demo data — link your child\'s account during signup for live data'}
            </p>
          )}
        </div>
        <button
          onClick={handleDownload}
          disabled={pdfLoading}
          className={`px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] ${pdfLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {pdfLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" />{isUrdu ? 'تیار ہو رہا ہے...' : 'Generating...'}</>
            : <><Download className="w-4 h-4" />{isUrdu ? 'PDF رپورٹ' : 'Download PDF Report'}</>}
        </button>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: TrendingUp,  label: isUrdu ? 'اوسط اسکور'  : 'Avg. Score',     value: `${data.avgScore}%`,        color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/20'     },
          { icon: Award,       label: isUrdu ? 'گریڈ'        : 'Overall Grade',   value: data.grade,                 color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { icon: Calendar,    label: isUrdu ? 'حاضری'       : 'Attendance',      value: `${data.attendanceRate}%`,  color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/20'  },
          { icon: Brain,       label: isUrdu ? 'کوئز'        : 'Quizzes Done',    value: String(data.quizCount),     color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20'    },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`glass-card p-5 border ${bg} flex flex-col gap-2`}>
            <div className={`flex items-center gap-2 text-xs font-medium ${color}`}>
              <Icon className="w-4 h-4" />{label}
            </div>
            <div className={`text-3xl font-bold text-white`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── AI Executive Summary ── */}
        <div className="glass-card p-6 flex flex-col gap-4">
          <h3 className={`font-bold text-slate-200 flex items-center gap-2 ${isUrdu ? 'flex-row-reverse font-urdu' : ''}`}>
            <Sparkles className="w-5 h-5 text-sky-400" />
            {isUrdu ? 'AI ایگزیکٹو سمری' : 'AI Executive Summary'}
          </h3>
          <p className={`text-slate-300 leading-relaxed text-sm ${isUrdu ? 'text-right font-urdu text-base' : ''}`}>
            {isUrdu ? data.summaryUr : data.summaryEn}
          </p>

          {/* Mastery bar */}
          <div className="mt-2">
            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
              <span className={isUrdu ? 'font-urdu' : ''}>{isUrdu ? 'فلیش کارڈ مہارت' : 'Flashcard Mastery'}</span>
              <span>{data.masteredCards}/{data.totalCards} ({data.masteryPct}%)</span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-700"
                style={{ width: `${data.masteryPct}%` }}
              />
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <BookOpen className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-400">{isUrdu ? 'نوٹس' : 'Study Notes'}</p>
                <p className="text-lg font-bold text-white">{data.notesCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-400">{isUrdu ? 'مکمل کارڈز' : 'Cards Mastered'}</p>
                <p className="text-lg font-bold text-white">{data.masteredCards}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Weekly Trend Chart ── */}
        <div className="glass-card p-6 flex flex-col gap-4">
          <h3 className={`font-bold text-slate-200 flex items-center gap-2 ${isUrdu ? 'flex-row-reverse font-urdu' : ''}`}>
            <TrendingUp className="w-5 h-5 text-purple-400" />
            {isUrdu ? 'ہفتہ وار کارکردگی' : 'Weekly Performance Trend'}
          </h3>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.trendData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#e2e8f0' }}
                  formatter={(v: any) => [`${v}%`, 'Score']}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#10b981', strokeWidth: 0 }}
                  activeDot={{ r: 7, fill: '#34d399' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ── Subject Breakdown ── */}
      <div className="glass-card p-6 flex flex-col gap-4">
        <h3 className={`font-bold text-slate-200 flex items-center gap-2 ${isUrdu ? 'flex-row-reverse font-urdu' : ''}`}>
          <BarChart3 className="w-5 h-5 text-sky-400" />
          {isUrdu ? 'مضمون کے مطابق کارکردگی' : 'Subject-wise Performance'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.subjectBreakdown.map((s) => (
            <div key={s.subject} className="flex flex-col gap-2 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-200">{s.subject}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{s.quizCount} {isUrdu ? 'کوئز' : 'quizzes'}</span>
                  <span className="text-sm font-bold" style={{ color: scoreColor(s.avgScore) }}>
                    {s.avgScore}%
                  </span>
                </div>
              </div>
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${s.avgScore}%`, backgroundColor: scoreColor(s.avgScore) }}
                />
              </div>
              <span className="text-xs" style={{ color: scoreColor(s.avgScore) }}>
                {s.avgScore >= 75 ? (isUrdu ? '✓ بہترین' : '✓ Strong') : s.avgScore >= 60 ? (isUrdu ? '~ درمیانی' : '~ Moderate') : (isUrdu ? '✗ توجہ درکار' : '✗ Needs Focus')}
              </span>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="mt-2 min-h-[180px]">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.subjectBreakdown} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="subject" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#e2e8f0' }}
                formatter={(v: any) => [`${v}%`, 'Avg Score']}
              />
              <Bar dataKey="avgScore" radius={[6, 6, 0, 0]}>
                {data.subjectBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={scoreColor(entry.avgScore)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Student Profile card ── */}
      <div className="glass-card p-5 flex items-center gap-4 border border-slate-700/50">
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <User className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate">{childName}</p>
          <p className="text-xs text-slate-400">{isUrdu ? 'طالب علم ID:' : 'Student ID:'} {data.studentId}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-white">{data.grade}</p>
          <p className="text-xs text-slate-400">{isUrdu ? 'مجموعی گریڈ' : 'Overall Grade'}</p>
        </div>
      </div>

    </div>
  );
}
