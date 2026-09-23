'use client';

import { useState, useEffect } from 'react';
import { Layers, ArrowRight, ArrowLeft, RefreshCcw, Rotate3D, Star, Sparkles, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { renderInlineMarkdown } from '@/lib/markdown';

/** Renders inline markdown (bold/italic/code) inside a span */
function MD({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(text || '') }}
    />
  );
}

const defaultFlashcards = [
  {
    id: '1',
    front_en: "What is Newton's **First Law**?",
    back_en: "An object at rest stays at rest, and an object in motion stays in motion, unless acted on by a *net external force*.",
    front_ur: "نیوٹن کا **پہلا قانون** کیا ہے؟",
    back_ur: "کوئی جسم اس وقت تک آرام یا یکساں حرکت کی حالت میں رہتا ہے جب تک اس پر کوئی بیرونی قوت عمل نہ کرے۔",
    mastered: false,
    subject: 'Physics',
    topic: 'Laws of Motion',
  },
];

export default function FlashcardsViewer({ language }: { language: 'EN' | 'UR' }) {
  const isUrdu = language === 'UR';

  const [cards, setCards] = useState<any[]>(defaultFlashcards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generator form state
  const [subject, setSubject] = useState('Physics');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState('medium');

  useEffect(() => {
    fetch('/api/flashcards')
      .then(res => res.json())
      .then(data => {
        if (data.flashcards && data.flashcards.length > 0) {
          setCards(data.flashcards);
        }
      })
      .catch(() => {/* fallback to default cards */});
  }, []);

  const card = cards[currentIndex] || defaultFlashcards[0];

  const toggleMastered = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedStatus = !card.mastered;
    setCards(prev => prev.map((c, i) => i === currentIndex ? { ...c, mastered: updatedStatus } : c));
    try {
      if (card.id && String(card.id).length > 5) {
        await fetch('/api/flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: card.id, mastered: updatedStatus }),
        });
      }
    } catch { /* best-effort */ }
  };

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(prev => (prev + 1) % cards.length), 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(prev => (prev - 1 + cards.length) % cards.length), 150);
  };

  const generateFlashcards = async () => {
    if (!topic.trim()) {
      toast.error(isUrdu ? 'براہ کرم موضوع درج کریں' : 'Please enter a topic');
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generate: true,
          student_id: 'demo-student',
          subject,
          topic,
          count,
          difficulty,
          language,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Generation failed');
      }
      const data = await res.json();
      if (data.flashcards && data.flashcards.length > 0) {
        setCards(data.flashcards);
        setCurrentIndex(0);
        setIsFlipped(false);
        setShowGenerator(false);
        toast.success(isUrdu ? `${data.flashcards.length} کارڈز تیار!` : `${data.flashcards.length} flashcards generated!`);
      }
    } catch (e: any) {
      console.error('[Flashcards]', e.message);
      toast.error(isUrdu ? `خرابی: ${e.message}` : `Error: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  /* ── Generator modal ── */
  if (showGenerator) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <div className="w-full max-w-xl glass-card p-8 animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-2xl font-bold text-white flex items-center gap-2 ${isUrdu ? 'font-urdu' : ''}`}>
              <Sparkles className="w-6 h-6 text-fuchsia-400" />
              {isUrdu ? 'AI فلیش کارڈز' : 'AI Flashcard Generator'}
            </h2>
            <button onClick={() => setShowGenerator(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-lg">✕</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium text-slate-300 mb-1.5 ${isUrdu ? 'font-urdu' : ''}`}>{isUrdu ? 'مضمون' : 'Subject'}</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-fuchsia-500"
              >
                <option>Physics</option>
                <option>Mathematics</option>
                <option>Chemistry</option>
                <option>Biology</option>
                <option>English</option>
                <option>Urdu</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium text-slate-300 mb-1.5 ${isUrdu ? 'font-urdu' : ''}`}>{isUrdu ? 'موضوع' : 'Topic'}</label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generateFlashcards()}
                placeholder={isUrdu ? 'مثال: قوانین حرکت' : 'e.g., Laws of Motion'}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-fuchsia-500 placeholder:text-slate-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium text-slate-300 mb-1.5 ${isUrdu ? 'font-urdu' : ''}`}>{isUrdu ? 'دشواری' : 'Difficulty'}</label>
                <select
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-fuchsia-500"
                >
                  <option value="easy">{isUrdu ? 'آسان' : 'Easy'}</option>
                  <option value="medium">{isUrdu ? 'درمیانی' : 'Medium'}</option>
                  <option value="hard">{isUrdu ? 'مشکل' : 'Hard'}</option>
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium text-slate-300 mb-1.5 ${isUrdu ? 'font-urdu' : ''}`}>{isUrdu ? 'تعداد' : 'Count'}</label>
                <input
                  type="number"
                  min="5"
                  max="20"
                  value={count}
                  onChange={e => setCount(parseInt(e.target.value) || 10)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-fuchsia-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={generateFlashcards}
            disabled={isGenerating}
            className={`w-full mt-6 px-6 py-3 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold transition-all shadow-[0_0_20px_rgba(217,70,239,0.3)] flex items-center justify-center gap-2 ${isGenerating ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {isGenerating
              ? <><Loader2 className="w-5 h-5 animate-spin" />{isUrdu ? 'تیار ہو رہا ہے...' : 'Generating...'}</>
              : <><Sparkles className="w-5 h-5" />{isUrdu ? 'کارڈز بنائیں' : 'Generate Flashcards'}</>}
          </button>
        </div>
      </div>
    );
  }

  /* ── Main viewer ── */
  const masteredCount = cards.filter(c => c.mastered).length;

  return (
    <div className="flex flex-col h-full items-center justify-center p-4">
      <div className="w-full max-w-2xl flex flex-col h-full animate-in fade-in duration-300">

        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-fuchsia-500/20 flex items-center justify-center border border-fuchsia-500/50 shadow-[0_0_15px_rgba(217,70,239,0.3)]">
              <Layers className="w-6 h-6 text-fuchsia-400" />
            </div>
            <div>
              <h2 className={`text-2xl font-bold text-white ${isUrdu ? 'font-urdu' : ''}`}>
                {isUrdu ? 'فلیش کارڈز' : 'Smart Flashcards'}
              </h2>
              <p className="text-xs text-slate-400">
                {masteredCount}/{cards.length} {isUrdu ? 'مکمل' : 'mastered'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGenerator(true)}
              className="px-4 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-bold flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              {isUrdu ? 'AI سے بنائیں' : 'AI Generate'}
            </button>
            <button
              onClick={toggleMastered}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                card.mastered
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:border-slate-600'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${card.mastered ? 'fill-emerald-400 text-emerald-400' : ''}`} />
              {card.mastered ? (isUrdu ? 'مکمل' : 'Mastered') : (isUrdu ? 'نشان لگائیں' : 'Mark')}
            </button>
            <div className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-mono text-sm">
              {currentIndex + 1}/{cards.length}
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="flex-1 flex flex-col items-center justify-center w-full mb-6" style={{ perspective: '1000px' }}>
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full max-w-xl cursor-pointer"
            style={{
              transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)',
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              position: 'relative',
              aspectRatio: '3/2',
            }}
          >
            {/* Front */}
            <div
              className="absolute inset-0 rounded-3xl bg-slate-800 border-2 border-slate-700 hover:border-fuchsia-500/40 p-8 flex flex-col items-center justify-center text-center shadow-xl transition-colors"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <span className="absolute top-5 left-5 text-xs uppercase tracking-widest font-bold text-fuchsia-400">
                {isUrdu ? 'سوال' : 'Question'}
              </span>
              <Rotate3D className="absolute top-5 right-5 w-5 h-5 text-slate-500" />
              <p className={`text-xl sm:text-2xl font-bold text-white leading-snug ${isUrdu ? 'font-urdu' : ''}`}>
                <MD text={isUrdu && card.front_ur ? card.front_ur : card.front_en} />
              </p>
              <p className="absolute bottom-4 text-xs text-slate-600">{isUrdu ? 'کلک کریں پلٹانے کے لیے' : 'Click to flip'}</p>
            </div>

            {/* Back */}
            <div
              className="absolute inset-0 rounded-3xl bg-slate-900 border-2 border-fuchsia-500/50 p-8 flex flex-col items-center justify-center text-center shadow-[0_0_30px_rgba(217,70,239,0.15)]"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <span className="absolute top-5 left-5 text-xs uppercase tracking-widest font-bold text-emerald-400">
                {isUrdu ? 'جواب' : 'Answer'}
              </span>
              <Rotate3D className="absolute top-5 right-5 w-5 h-5 text-slate-500" />
              <p className={`text-lg sm:text-xl text-slate-200 leading-relaxed ${isUrdu ? 'font-urdu' : ''}`}>
                <MD text={isUrdu && card.back_ur ? card.back_ur : card.back_en} />
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-center items-center gap-6">
          <button onClick={handlePrev} className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 text-white transition-colors border border-slate-700 hover:border-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsFlipped(!isFlipped)}
            className={`px-8 py-3 rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold transition-all shadow-[0_0_20px_rgba(217,70,239,0.3)] flex items-center gap-2 ${isUrdu ? 'font-urdu' : ''}`}
          >
            <RefreshCcw className={`w-5 h-5 transition-transform duration-500 ${isFlipped ? 'rotate-180' : ''}`} />
            {isUrdu ? 'پلٹائیں' : 'Flip Card'}
          </button>
          <button onClick={handleNext} className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 text-white transition-colors border border-slate-700 hover:border-slate-600">
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  );
}
