'use client';

import { useState } from 'react';
import { FileText, Download, Loader2, BookOpen, Sparkles, ArrowLeft, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const SUBJECTS = ['Physics', 'Mathematics', 'Chemistry', 'Biology', 'Urdu', 'English', 'Computer Science'];

const CHAPTERS: Record<string, string[]> = {
  Physics: [
    'Chapter 1: Physical Quantities & Measurement',
    'Chapter 2: Kinematics',
    'Chapter 3: Dynamics',
    'Chapter 4: Turning Effect of Forces',
    'Chapter 5: Gravitation',
    'Chapter 6: Work & Energy',
    'Chapter 7: Simple Machines',
    'Chapter 8: Waves',
    'Chapter 9: Sound',
    'Chapter 10: Geometrical Optics',
  ],
  Mathematics: [
    'Chapter 1: Quadratic Equations',
    'Chapter 2: Theory of Sets',
    'Chapter 3: Logarithms',
    'Chapter 4: Algebraic Expressions',
    'Chapter 5: Linear Equations',
    'Chapter 6: Trigonometry',
    'Chapter 7: Practical Geometry',
  ],
  Chemistry: [
    'Chapter 1: Fundamentals of Chemistry',
    'Chapter 2: Structure of Atoms',
    'Chapter 3: Periodic Table',
    'Chapter 4: Structure of Molecules',
    'Chapter 5: Chemical Bonding',
    'Chapter 6: Chemical Reactivity',
  ],
  Biology: [
    'Chapter 1: Cell Biology',
    'Chapter 2: Biodiversity',
    'Chapter 3: Bioenergetics',
    'Chapter 4: Nutrition',
    'Chapter 5: Transport',
    'Chapter 6: Reproduction',
    'Chapter 7: Support & Movement',
  ],
};

/**
 * Minimal Markdown to HTML renderer.
 *
 * Processes input line-by-line so block elements (headings, list items) are
 * never wrapped inside <p> tags, which produces invalid HTML and causes
 * browsers to silently restructure the DOM.
 */
function renderMarkdown(md: string): string {
  const inline = (text: string) =>
    text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="text-slate-300">$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-slate-800 px-1.5 py-0.5 rounded text-sky-300 text-sm font-mono">$1</code>');

  const lines = md.split('\n');
  const out: string[] = [];
  let inParagraph = false;

  const closeParagraph = () => {
    if (inParagraph) {
      out.push('</p>');
      inParagraph = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === '') {
      closeParagraph();
      continue;
    }

    if (/^### (.+)$/.test(line)) {
      closeParagraph();
      out.push(`<h3 class="text-lg font-bold text-purple-300 mt-6 mb-2">${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (/^## (.+)$/.test(line)) {
      closeParagraph();
      out.push(`<h2 class="text-xl font-bold text-purple-400 mt-8 mb-3 border-b border-slate-700 pb-2">${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (/^# (.+)$/.test(line)) {
      closeParagraph();
      out.push(`<h1 class="text-2xl font-bold text-purple-400 mb-6 border-b border-slate-700 pb-4">${inline(line.slice(2))}</h1>`);
      continue;
    }
    if (/^- (.+)$/.test(line)) {
      closeParagraph();
      out.push(`<li class="text-slate-300 ml-4 list-disc mb-1">${inline(line.slice(2))}</li>`);
      continue;
    }
    const olMatch = line.match(/^(\d+)\. (.+)$/);
    if (olMatch) {
      closeParagraph();
      out.push(`<li class="text-slate-300 ml-4 list-decimal mb-1">${inline(olMatch[2])}</li>`);
      continue;
    }

    if (!inParagraph) {
      out.push('<p class="text-slate-300 leading-relaxed mb-3">');
      inParagraph = true;
    } else {
      out.push('<br/>');
    }
    out.push(inline(line));
  }

  closeParagraph();
  return out.join('');
}

export default function AINotesGenerator({ language }: { language: 'EN' | 'UR' }) {
  const isUrdu = language === 'UR';

  const [step, setStep] = useState<'config' | 'generating' | 'notes'>('config');
  const [subject, setSubject] = useState('Physics');
  const [chapter, setChapter] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [notesMarkdown, setNotesMarkdown] = useState('');
  const [copied, setCopied] = useState(false);

  const chaptersForSubject = CHAPTERS[subject] || [];

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error(isUrdu ? 'براہ کرم موضوع درج کریں' : 'Please enter a topic');
      return;
    }

    setStep('generating');

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generate: true,
          subject,
          topic,
          chapter: chapter || undefined,
          difficulty,
          language,
          student_id: 'demo-student',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Generation failed');
      }

      const data = await res.json();
      setNotesMarkdown(data.notes || '');
      setStep('notes');
      toast.success(isUrdu ? 'نوٹس تیار ہو گئے!' : 'Notes generated successfully!');
    } catch (e: any) {
      console.error('[AINotesGenerator]', e.message);
      toast.error(isUrdu ? 'نوٹس بنانے میں خرابی' : `Failed: ${e.message}`);
      setStep('config');
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(notesMarkdown);
    setCopied(true);
    toast.success(isUrdu ? 'کاپی ہو گیا!' : 'Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([notesMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${subject}_${topic.replace(/\s+/g, '_')}_notes.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(isUrdu ? 'فائل ڈاؤن لوڈ ہو رہی ہے' : 'Downloading notes file...');
  };

  /* Config screen */
  if (step === 'config') {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <div className="w-full max-w-2xl glass-card p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
            <FileText className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className={`text-2xl font-bold text-white mb-2 ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu ? 'AI نوٹس جنریٹر' : 'AI Notes Generator'}
          </h2>
          <p className={`text-slate-400 mb-8 max-w-md ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu
              ? 'اپنے نصاب کے مطابق AI سے مکمل اور منظم نوٹس بنائیں۔'
              : 'Generate complete, curriculum-aligned study notes for any subject using AI.'}
          </p>

          <div className="grid grid-cols-1 gap-4 w-full mb-6 text-left">
            <div>
              <label className={`block text-sm font-medium text-slate-300 mb-1.5 ${isUrdu ? 'font-urdu' : ''}`}>
                {isUrdu ? 'مضمون' : 'Subject'}
              </label>
              <select
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setChapter(''); }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-purple-500"
              >
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {chaptersForSubject.length > 0 && (
              <div>
                <label className={`block text-sm font-medium text-slate-300 mb-1.5 ${isUrdu ? 'font-urdu' : ''}`}>
                  {isUrdu ? 'باب (اختیاری)' : 'Chapter (optional)'}
                </label>
                <select
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-purple-500"
                >
                  <option value="">{isUrdu ? '-- باب منتخب کریں --' : '-- Select a chapter --'}</option>
                  {chaptersForSubject.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className={`block text-sm font-medium text-slate-300 mb-1.5 ${isUrdu ? 'font-urdu' : ''}`}>
                {isUrdu ? 'موضوع / عنوان' : 'Topic / Concept'}
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder={isUrdu ? 'مثال: نیوٹن کے قوانین حرکت' : "e.g., Newton's Laws of Motion"}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className={`block text-sm font-medium text-slate-300 mb-1.5 ${isUrdu ? 'font-urdu' : ''}`}>
                {isUrdu ? 'سطح' : 'Level'}
              </label>
              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                      difficulty === d
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-purple-500/50 hover:text-slate-200'
                    }`}
                  >
                    {isUrdu
                      ? d === 'easy' ? 'آسان' : d === 'medium' ? 'درمیانی' : 'مشکل'
                      : d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            className="w-full px-8 py-3 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            {isUrdu ? 'نوٹس تیار کریں' : 'Generate Notes'}
          </button>
        </div>
      </div>
    );
  }

  /* Generating screen */
  if (step === 'generating') {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <div className="w-full max-w-md flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
          <div className="relative mb-8">
            <div className="w-20 h-20 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <FileText className="w-8 h-8 text-purple-400" />
            </div>
          </div>
          <h3 className={`text-xl font-bold text-white mb-2 ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu ? 'AI نوٹس تیار کر رہا ہے...' : 'AI is writing your notes...'}
          </h3>
          <p className={`text-slate-400 text-sm ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu
              ? `${subject} — ${topic} کے لیے جامع نوٹس مرتب ہو رہے ہیں`
              : `Generating comprehensive notes for ${subject}: ${topic}`}
          </p>
          <div className="flex gap-1.5 mt-6">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-purple-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* Notes display screen */
  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-400 p-4">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
            <BookOpen className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{subject}: {topic}</h2>
            <p className="text-xs text-slate-400">
              {chapter || (isUrdu ? 'AI سے تیار کردہ نوٹس' : 'AI-generated study notes')}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setStep('config')}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 font-medium transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            {isUrdu ? 'واپس' : 'Back'}
          </button>
          <button
            onClick={handleCopy}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 font-medium transition-colors flex items-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {isUrdu ? 'کاپی' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm text-white font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {isUrdu ? 'ڈاؤن لوڈ' : 'Download'}
          </button>
        </div>
      </div>

      {/* Notes Content - dangerouslySetInnerHTML with no outer <p> wrapper */}
      <div
        className={`glass-card flex-1 p-6 sm:p-10 overflow-y-auto scrollbar-hide border border-slate-700/50 bg-slate-900/80 ${isUrdu ? 'text-right font-urdu' : ''}`}
        dir={isUrdu ? 'rtl' : 'ltr'}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(notesMarkdown) }}
      />

      <div className="mt-4 flex justify-center">
        <button
          onClick={handleGenerate}
          className="px-6 py-2 rounded-full bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 text-sm font-medium transition-all flex items-center gap-2"
        >
          <Loader2 className="w-4 h-4" />
          {isUrdu ? 'دوبارہ تیار کریں' : 'Regenerate'}
        </button>
      </div>
    </div>
  );
}