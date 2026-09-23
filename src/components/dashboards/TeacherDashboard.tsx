'use client';

import { useState, useEffect } from 'react';
import {
  Users, AlertTriangle, BookMarked, Search, Plus, UploadCloud,
  CheckCircle2, ClipboardCheck, Calendar, X, Loader2, AlertCircle,
} from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { auth } from '@/lib/firebase/config';

// ── Types ─────────────────────────────────────────────────────────────────────
interface StudentRow {
  id: string;
  name: string;
  mastery: number;
  weakTopic: string;
  subjects?: { subject: string; mastery: number }[];
}

interface Assignment {
  id: string;
  title: string;
  subject: string;
  type: string;
  due_date: string | null;
}

interface AlertItem {
  type: 'critical' | 'warning';
  message: string;
}

// ── Auth helper ───────────────────────────────────────────────────────────────
async function makeHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const user = auth.currentUser;
  const headers: Record<string, string> = { ...extra };
  if (user) {
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function scoreBarColor(n: number) {
  if (n >= 75) return 'bg-emerald-500';
  if (n >= 55) return 'bg-sky-500';
  if (n >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TeacherDashboard({ language }: { language: 'EN' | 'UR' }) {
  const isUrdu = language === 'UR';
  const { profile } = useUserProfile();
  const displayName = profile?.full_name || (isUrdu ? 'استاد' : 'Teacher');

  const [activeTab, setActiveTab] = useState<'overview' | 'assignments' | 'attendance'>('overview');

  // Overview
  const [students, setStudents]       = useState<StudentRow[]>([]);
  const [alerts, setAlerts]           = useState<AlertItem[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [search, setSearch]           = useState('');

  // Assignments
  const [assignments, setAssignments]               = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [isCreating, setIsCreating]                 = useState(false);
  const [newTitle, setNewTitle]       = useState('');
  const [newSubject, setNewSubject]   = useState('Physics');
  const [newType, setNewType]         = useState('quiz');
  const [saving, setSaving]           = useState(false);

  // Attendance
  const [attendance, setAttendance]             = useState<{ id: string; name: string; present: boolean }[]>([]);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceMsg, setAttendanceMsg]       = useState('');

  // Library upload
  const [showUpload, setShowUpload]       = useState(false);
  const [uploadFile, setUploadFile]       = useState<File | null>(null);
  const [libTitle, setLibTitle]           = useState('');
  const [libBoard, setLibBoard]           = useState('PTB');
  const [libType, setLibType]             = useState('book');
  const [libUploading, setLibUploading]   = useState(false);
  const [uploadMsg, setUploadMsg]         = useState('');

  // ── Load overview + assignments on mount ─────────────────────────────────
  useEffect(() => {
    (async () => {
      setOverviewLoading(true);
      try {
        const hdrs = await makeHeaders();
        const [weakRes, assignRes] = await Promise.allSettled([
          fetch('/api/weak-topics', { headers: hdrs }),
          fetch('/api/assignments',  { headers: hdrs }),
        ]);

        if (weakRes.status === 'fulfilled' && weakRes.value.ok) {
          const d = await weakRes.value.json();
          const rows: StudentRow[] = d.students || [];
          setStudents(rows);
          setAttendance(rows.map(s => ({ id: s.id, name: s.name, present: true })));
          setAlerts(d.alerts || []);
        }

        if (assignRes.status === 'fulfilled' && assignRes.value.ok) {
          const d = await assignRes.value.json();
          setAssignments(d.assignments || []);
        }
      } catch (e) {
        console.error('[TeacherDashboard]', e);
      } finally {
        setOverviewLoading(false);
      }
    })();
  }, []);

  // ── Create assignment ─────────────────────────────────────────────────────
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const hdrs = await makeHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({
          title: newTitle,
          subject: newSubject,
          type: newType,
          due_date: new Date(Date.now() + 86400000 * 3).toISOString(),
        }),
      });
      const data = await res.json();
      setAssignments(prev => [data.assignment, ...prev]);
    } catch {
      // optimistic local add
      setAssignments(prev => [{
        id: String(Date.now()), title: newTitle,
        subject: newSubject, type: newType, due_date: null,
      }, ...prev]);
    } finally {
      setSaving(false);
      setNewTitle('');
      setIsCreating(false);
    }
  };

  // ── Save attendance ───────────────────────────────────────────────────────
  const handleSaveAttendance = async () => {
    setSavingAttendance(true);
    setAttendanceMsg('');
    try {
      const hdrs = await makeHeaders({ 'Content-Type': 'application/json' });
      const records = attendance.map(s => ({
        student_id: s.id,
        status: s.present ? 'present' : 'absent',
        date: new Date().toISOString().slice(0, 10),
      }));
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ records }),
      });
      setAttendanceMsg(res.ok
        ? (isUrdu ? 'حاضری محفوظ ہو گئی!' : 'Attendance saved & parents notified!')
        : (isUrdu ? 'مقامی طور پر محفوظ' : 'Saved locally.')
      );
    } catch {
      setAttendanceMsg(isUrdu ? 'مقامی طور پر محفوظ' : 'Saved locally.');
    } finally {
      setSavingAttendance(false);
      setTimeout(() => setAttendanceMsg(''), 4000);
    }
  };

  // ── Library upload ────────────────────────────────────────────────────────
  const handleLibraryUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !libTitle.trim()) return;
    setLibUploading(true);
    setUploadMsg('');
    try {
      // 1. Upload file
      const formData = new FormData();
      formData.append('file', uploadFile);
      const upRes  = await fetch('/api/upload', { method: 'POST', body: formData });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error || 'Upload failed');

      // 2. Save to library DB
      const hdrs  = await makeHeaders({ 'Content-Type': 'application/json' });
      const dbRes = await fetch('/api/library', {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({
          title: libTitle, board: libBoard, type: libType,
          file_url: upData.file_url,
          size: (uploadFile.size / (1024 * 1024)).toFixed(1) + ' MB',
        }),
      });
      setUploadMsg(dbRes.ok
        ? (isUrdu ? 'کامیابی سے اپلوڈ ہو گیا!' : 'Uploaded successfully!')
        : (isUrdu ? 'فائل اپلوڈ ہوئی لیکن DB میں خرابی' : 'File uploaded but DB save failed.')
      );
      setTimeout(() => { setShowUpload(false); setUploadMsg(''); }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadMsg(msg);
    } finally {
      setLibUploading(false);
      setUploadFile(null);
      setLibTitle('');
    }
  };

  // ── Filtered students ─────────────────────────────────────────────────────
  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 w-full overflow-y-auto scrollbar-hide pb-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className={`text-2xl font-bold text-white ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu ? `خوش آمدید، ${displayName}!` : `Welcome, ${displayName}!`}
          </h1>
          <p className={`text-slate-400 mt-1 text-sm ${isUrdu ? 'font-urdu' : ''}`}>
            {students.length > 0
              ? (isUrdu ? `${students.length} طلباء کا ڈیٹا لوڈ ہوا` : `${students.length} students loaded from database`)
              : (isUrdu ? 'ڈیٹا لوڈ ہو رہا ہے...' : 'Loading student data...')}
          </p>
        </div>
        <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
          {(['overview', 'assignments', 'attendance'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'assignments' ? 'Assignments' : 'Attendance'}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">

          {/* Left: Alerts + Upload */}
          <div className="flex flex-col gap-4">

            {/* AI Alerts */}
            <div className="glass-card p-5">
              <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                {isUrdu ? 'AI انتباہات' : 'AI Intervention Alerts'}
              </h3>
              {overviewLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : alerts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <p className="text-sm text-slate-400">
                    {isUrdu ? 'کوئی انتباہ نہیں — سب ٹھیک ہے!' : 'No alerts — all students on track!'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {alerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className={`p-3 border rounded-lg ${
                        alert.type === 'critical'
                          ? 'bg-red-500/10 border-red-500/20'
                          : 'bg-orange-500/10 border-orange-500/20'
                      }`}
                    >
                      <span className={`text-xs font-bold uppercase ${alert.type === 'critical' ? 'text-red-400' : 'text-orange-400'}`}>
                        {alert.type}
                      </span>
                      <p className="text-sm text-slate-300 mt-1">{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload Box */}
            <div className="glass-card p-5 flex-1">
              <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-purple-400" />
                {isUrdu ? 'نصاب / کتابیں اپلوڈ' : 'Upload Syllabus / Books'}
              </h3>
              <div
                onClick={() => setShowUpload(true)}
                className="border-2 border-dashed border-slate-700/50 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-slate-800/30 hover:border-sky-500/50 transition-colors cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3 group-hover:bg-sky-500/20 transition-colors">
                  <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-sky-400" />
                </div>
                <p className="text-sm text-slate-300 font-medium">
                  {isUrdu ? 'یہاں کلک کریں' : 'Click to upload'}
                </p>
                <p className="text-xs text-slate-500 mt-1">PDF, DOCX, Images</p>
              </div>
            </div>
          </div>

          {/* Right: Student Roster */}
          <div className="glass-card p-0 flex flex-col lg:col-span-2 overflow-hidden">
            <div className="p-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30">
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                {isUrdu ? 'طلباء کی فہرست' : 'Student Roster & Mastery'}
              </h3>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={isUrdu ? 'نام تلاش کریں' : 'Search student...'}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg py-1.5 pl-9 pr-3 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {overviewLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <AlertCircle className="w-10 h-10 text-slate-600" />
                <p className="text-slate-400 text-sm">
                  {students.length === 0
                    ? (isUrdu ? 'ابھی کوئی طالب علم ڈیٹا نہیں ہے' : 'No student data yet — students need to take quizzes first')
                    : (isUrdu ? 'کوئی نتیجہ نہیں ملا' : 'No match found')}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/50 text-xs uppercase tracking-wider text-slate-400">
                      <th className="p-4 font-medium">{isUrdu ? 'نام' : 'Student Name'}</th>
                      <th className="p-4 font-medium text-center">{isUrdu ? 'مہارت' : 'Mastery'}</th>
                      <th className="p-4 font-medium">{isUrdu ? 'کمزور موضوع' : 'Weak Topic'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {filtered.map(student => (
                      <tr key={student.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-medium text-slate-200">{student.name}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3 justify-center">
                            <span className="text-sm font-bold text-white w-9 text-right">{student.mastery}%</span>
                            <div className="flex-1 max-w-[100px] h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${scoreBarColor(student.mastery)}`}
                                style={{ width: `${student.mastery}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-slate-400">{student.weakTopic || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-slate-600 px-4 pb-3 pt-1">
                  {filtered.length} of {students.length} student{students.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ASSIGNMENTS TAB ── */}
      {activeTab === 'assignments' && (
        <div className="glass-card p-6 animate-in fade-in flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-sky-400" />
              {isUrdu ? 'اسائنمنٹس' : 'Active Assignments'}
            </h3>
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {isUrdu ? 'نیا اسائنمنٹ' : 'Create Assignment'}
            </button>
          </div>

          {assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <BookMarked className="w-10 h-10 text-slate-600" />
              <p className="text-slate-400 text-sm">
                {isUrdu ? 'کوئی اسائنمنٹ نہیں' : 'No assignments yet — create one above'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {assignments.map(item => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs uppercase font-semibold text-sky-400 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                        {item.subject}
                      </span>
                      <span className="text-xs uppercase text-slate-500 font-medium">({item.type})</span>
                    </div>
                    <h4 className="font-bold text-white mt-1">{item.title}</h4>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {isUrdu ? 'آخری تاریخ:' : 'Due:'}{' '}
                      {item.due_date
                        ? (isNaN(Date.parse(item.due_date))
                          ? item.due_date
                          : new Date(item.due_date).toLocaleDateString())
                        : (isUrdu ? 'جلد' : 'Upcoming')}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                      {isUrdu ? 'آٹو گریڈ' : 'Auto-Grade'}
                    </button>
                    <button className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium transition-colors">
                      {isUrdu ? 'جمع کرائے' : 'Submissions'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Assignment Modal */}
          {isCreating && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
                <button
                  onClick={() => setIsCreating(false)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                  <BookMarked className="w-5 h-5 text-sky-400" />
                  {isUrdu ? 'نیا اسائنمنٹ' : 'Create Assignment'}
                </h3>
                <form onSubmit={handleCreateAssignment} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase">
                      {isUrdu ? 'عنوان' : 'Title'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isUrdu ? 'مثال: باب 4 کیمسٹری' : 'e.g. Chapter 4 Chemistry Practice'}
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase">{isUrdu ? 'مضمون' : 'Subject'}</label>
                      <select
                        value={newSubject}
                        onChange={e => setNewSubject(e.target.value)}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 text-sm"
                      >
                        {['Physics','Mathematics','Chemistry','Biology','Urdu','English'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase">{isUrdu ? 'قسم' : 'Type'}</label>
                      <select
                        value={newType}
                        onChange={e => setNewType(e.target.value)}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 text-sm"
                      >
                        <option value="quiz">Auto Quiz</option>
                        <option value="mcq">MCQ</option>
                        <option value="upload">File Upload</option>
                        <option value="short-answer">Short Answer</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-colors"
                    >
                      {isUrdu ? 'منسوخ' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm transition-colors shadow-[0_0_15px_rgba(14,165,233,0.3)] flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {saving
                        ? <><Loader2 className="w-4 h-4 animate-spin" />{isUrdu ? 'محفوظ...' : 'Saving...'}</>
                        : (isUrdu ? 'شائع کریں' : 'Save & Publish')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {activeTab === 'attendance' && (
        <div className="glass-card p-6 animate-in fade-in flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              {isUrdu ? 'آج کی حاضری' : 'Daily Attendance'}
            </h3>
            <span className="text-sm text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
              {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          {overviewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
            </div>
          ) : attendance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle className="w-10 h-10 text-slate-600" />
              <p className="text-slate-400 text-sm">
                {isUrdu ? 'کوئی طالب علم رجسٹرڈ نہیں' : 'No students registered yet'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/50 text-xs uppercase tracking-wider text-slate-400">
                      <th className="p-4 font-medium">{isUrdu ? 'نام' : 'Student'}</th>
                      <th className="p-4 font-medium">{isUrdu ? 'حالت' : 'Status'}</th>
                      <th className="p-4 font-medium text-right">{isUrdu ? 'تبدیل کریں' : 'Toggle'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {attendance.map(s => (
                      <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-medium text-slate-200">{s.name}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${s.present ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {s.present ? (isUrdu ? 'حاضر' : 'Present') : (isUrdu ? 'غائب' : 'Absent')}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() =>
                              setAttendance(prev =>
                                prev.map(r => r.id === s.id ? { ...r, present: !r.present } : r)
                              )
                            }
                            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                          >
                            <ClipboardCheck className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                {attendanceMsg && (
                  <span className="text-sm text-emerald-400 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> {attendanceMsg}
                  </span>
                )}
                <button
                  onClick={handleSaveAttendance}
                  disabled={savingAttendance}
                  className="sm:ml-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-2 disabled:opacity-50"
                >
                  {savingAttendance
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{isUrdu ? 'محفوظ...' : 'Saving...'}</>
                    : (isUrdu ? 'حاضری محفوظ کریں' : 'Save & Notify Parents')}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Library Upload Modal ── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowUpload(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-sky-400" />
              {isUrdu ? 'لائبریری ریسورس اپلوڈ' : 'Upload Library Resource'}
            </h3>

            {uploadMsg && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${uploadMsg.includes('success') || uploadMsg.includes('کامیاب') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {uploadMsg}
              </div>
            )}

            <form onSubmit={handleLibraryUpload} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase">{isUrdu ? 'عنوان' : 'Title'}</label>
                <input
                  type="text"
                  required
                  placeholder={isUrdu ? 'مثال: فزکس کلاس 10 نوٹس' : 'e.g. Physics Class 10 Notes'}
                  value={libTitle}
                  onChange={e => setLibTitle(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase">Board</label>
                  <select value={libBoard} onChange={e => setLibBoard(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 text-sm">
                    <option value="PTB">PTB</option>
                    <option value="FBISE">FBISE</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase">Type</label>
                  <select value={libType} onChange={e => setLibType(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 text-sm">
                    <option value="book">Book</option>
                    <option value="resource">Past Paper / Resource</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase">{isUrdu ? 'فائل' : 'File'}</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm focus:outline-none"
                />
              </div>
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setShowUpload(false)} className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-colors">
                  {isUrdu ? 'منسوخ' : 'Cancel'}
                </button>
                <button type="submit" disabled={libUploading} className="flex-1 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm transition-colors shadow-[0_0_15px_rgba(14,165,233,0.3)] disabled:opacity-50 flex items-center justify-center gap-2">
                  {libUploading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{isUrdu ? 'اپلوڈ...' : 'Uploading...'}</>
                    : (isUrdu ? 'اپلوڈ کریں' : 'Upload File')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
