'use client';

import { useState } from 'react';
import { Target, CheckCircle2, XCircle, BrainCircuit, Activity, Loader2, RefreshCw, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { renderInlineMarkdown, renderMarkdown } from '@/lib/markdown';

interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty: string;
}

/** Small wrapper — renders inline markdown safely */
function MD({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(text) }}
    />
  );
}

/** Block markdown for explanations */
function MDBlock({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  );
}

export default function SmartQuizGenerator({ language }: { language: 'EN' | 'UR' }) {
  const isUrdu = language === 'UR';

  const [currentStep, setCurrentStep] = useState<'config' | 'quiz' | 'results'>('config');
  const [subject, setSubject] = useState('Physics');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);

  const generateQuiz = async () => {
    if (!topic.trim()) {
      toast.error(isUrdu ? 'براہ کرم موضوع درج کریں' : 'Please enter a topic');
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generate: true,
          student_id: 'demo-student',
          subject,
          topic,
          questionCount,
          difficulty,
          questionType: 'mcq',
          language,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Quiz generation failed');
      }
      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setCurrentQuestionIndex(0);
        setSelectedAnswers({});
        setShowExplanation(false);
        setScore(0);
        setCurrentStep('quiz');
        toast.success(isUrdu ? `${data.questions.length} سوالات تیار!` : `${data.questions.length} questions ready!`);
      } else {
        throw new Error('No questions returned');
      }
    } catch (e: any) {
      console.error('[Quiz]', e.message);
      toast.error(isUrdu ? `خرابی: ${e.message}` : `Error: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswers[currentQuestionIndex] !== undefined) return; // already answered
    const isCorrect = answer === questions[currentQuestionIndex]?.correct_answer;
    setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: answer }));
    if (isCorrect) setScore(s => s + 1);
    setShowExplanation(true);
  };

  const handleNext = () => {
    setShowExplanation(false);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(i => i + 1);
    } else {
      setCurrentStep('results');
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const selectedAnswer = selectedAnswers[currentQuestionIndex];

  /* ── Config ── */
  if (currentStep === 'config') {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <div className="w-full max-w-2xl glass-card p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-2xl bg-sky-500/20 flex items-center justify-center mb-6 neon-border-blue">
            <Target className="w-8 h-8 text-sky-400" />
          </div>
          <h2 className={`text-2xl font-bold text-white mb-2 ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu ? 'سمارٹ تشخیصی کوئز' : 'Smart Diagnostic Quiz'}
          </h2>
          <p className={`text-slate-400 mb-8 max-w-md ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu
              ? 'AI آپ کی کمزور جگہوں کی بنیاد پر ایک adaptive ٹیسٹ بنائے گا۔'
              : 'Generate an adaptive test calibrated to FBISE and PTB standards.'}
          </p>

          <div className="grid grid-cols-1 gap-4 w-full mb-6">
            <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 text-left">
              <h4 className="font-semibold text-slate-200 mb-2">{isUrdu ? 'مضمون' : 'Subject'}</h4>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-300 focus:outline-none focus:border-sky-500"
              >
                <option>Physics</option>
                <option>Mathematics</option>
                <option>Chemistry</option>
                <option>Biology</option>
                <option>Urdu</option>
                <option>English</option>
              </select>
            </div>

            <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 text-left">
              <h4 className="font-semibold text-slate-200 mb-2">{isUrdu ? 'موضوع' : 'Topic'}</h4>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateQuiz()}
                placeholder={isUrdu ? 'مثال: نیوٹن کے قوانین' : "e.g., Newton's Laws"}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-300 focus:outline-none focus:border-sky-500 placeholder:text-slate-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 text-left">
                <h4 className="font-semibold text-slate-200 mb-2">{isUrdu ? 'دشواری' : 'Difficulty'}</h4>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-300 focus:outline-none focus:border-sky-500"
                >
                  <option value="easy">{isUrdu ? 'آسان' : 'Easy'}</option>
                  <option value="medium">{isUrdu ? 'درمیانی' : 'Medium'}</option>
                  <option value="hard">{isUrdu ? 'مشکل' : 'Hard'}</option>
                </select>
              </div>
              <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 text-left">
                <h4 className="font-semibold text-slate-200 mb-2">{isUrdu ? 'سوالات' : 'Questions'}</h4>
                <input
                  type="number"
                  min="5"
                  max="20"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value) || 10)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-300 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={generateQuiz}
            disabled={isGenerating}
            className={`px-8 py-3 rounded-full bg-sky-500 hover:bg-sky-400 text-white font-bold transition-all shadow-[0_0_20px_rgba(14,165,233,0.4)] flex items-center gap-2 ${isGenerating ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {isGenerating ? (
              <><Loader2 className="w-5 h-5 animate-spin" />{isUrdu ? 'تیار ہو رہا ہے...' : 'Generating...'}</>
            ) : (
              <><BrainCircuit className="w-5 h-5" />{isUrdu ? 'کوئز شروع کریں' : 'Generate & Start Quiz'}</>
            )}
          </button>
        </div>
      </div>
    );
  }

  /* ── Quiz ── */
  if (currentStep === 'quiz' && currentQuestion) {
    const progress = ((currentQuestionIndex) / questions.length) * 100;

    return (
      <div className="flex flex-col h-full p-4 animate-in fade-in duration-300">
        {/* Progress bar */}
        <div className="w-full bg-slate-800 rounded-full h-1.5 mb-4">
          <div
            className="bg-sky-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <span className="font-mono font-bold text-sky-400">{currentQuestionIndex + 1}</span>
            <span>/ {questions.length}</span>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs capitalize">{currentQuestion.difficulty}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <Activity className="w-3.5 h-3.5" />
            {isUrdu ? `اسکور: ${score}` : `Score: ${score}`}
          </div>
        </div>

        <div className="flex-1 flex flex-col glass-card p-6 sm:p-8 overflow-y-auto">
          {/* Question */}
          <div className={`text-base sm:text-lg font-medium text-white mb-6 leading-relaxed ${isUrdu ? 'text-right font-urdu' : ''}`}>
            <MDBlock text={currentQuestion.question} />
          </div>

          {/* Options */}
          <div className="flex flex-col gap-3">
            {currentQuestion.options.map((opt, idx) => {
              const label = String.fromCharCode(65 + idx);
              const isSelected = selectedAnswer === opt;
              const isCorrect = opt === currentQuestion.correct_answer;
              const answered = selectedAnswer !== undefined;

              let style = 'border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/50 hover:border-sky-500/40';
              if (answered && isCorrect)  style = 'border-emerald-500/60 bg-emerald-900/20';
              else if (answered && isSelected) style = 'border-red-500/60 bg-red-900/20';

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswerSelect(opt)}
                  disabled={answered}
                  className={`w-full p-4 rounded-xl border transition-all flex items-center gap-4 text-left ${style} ${answered ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                    answered && isCorrect ? 'bg-emerald-500 text-white'
                    : answered && isSelected ? 'bg-red-500 text-white'
                    : isSelected ? 'bg-sky-500 text-white'
                    : 'bg-slate-900 text-slate-400'
                  }`}>
                    {answered && isCorrect ? <CheckCircle2 className="w-4 h-4" /> : answered && isSelected ? <XCircle className="w-4 h-4" /> : label}
                  </div>
                  <span className={`text-slate-200 text-sm leading-relaxed ${isUrdu ? 'font-urdu' : ''}`}>
                    <MD text={opt} />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {showExplanation && currentQuestion.explanation && (
            <div className="mt-5 p-4 rounded-xl bg-slate-800/60 border border-slate-600/50 animate-in slide-in-from-bottom-2 duration-300">
              <p className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-2">
                {isUrdu ? 'وضاحت' : 'Explanation'}
              </p>
              <MDBlock
                text={currentQuestion.explanation}
                className="text-sm text-slate-300 leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* Next button — shown after answering */}
        {selectedAnswer !== undefined && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white font-bold transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(14,165,233,0.3)]"
            >
              {currentQuestionIndex < questions.length - 1
                ? (isUrdu ? 'اگلا سوال' : 'Next Question')
                : (isUrdu ? 'نتائج دیکھیں' : 'See Results')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ── Results ── */
  if (currentStep === 'results') {
    const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    const color = pct >= 70 ? 'border-emerald-500 shadow-emerald-500/20' : pct >= 50 ? 'border-yellow-500 shadow-yellow-500/20' : 'border-red-500 shadow-red-500/20';

    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <div className="w-full max-w-2xl glass-card p-8 flex flex-col items-center animate-in slide-in-from-bottom-8 duration-500">
          <div className={`w-28 h-28 rounded-full bg-slate-900 border-[6px] flex items-center justify-center shadow-xl mb-6 ${color}`}>
            <span className="text-3xl font-bold text-white">{pct}%</span>
          </div>

          <h2 className={`text-2xl font-bold text-white mb-1 ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu ? 'کوئز مکمل!' : 'Quiz Complete!'}
          </h2>
          <p className={`text-slate-400 mb-6 text-center ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu
              ? `آپ نے ${questions.length} میں سے ${score} سوالات صحیح کیے۔`
              : `You scored ${score} out of ${questions.length} questions correctly.`}
          </p>

          {/* Per-question review */}
          <div className="w-full max-h-64 overflow-y-auto space-y-2 mb-6">
            {questions.map((q, idx) => {
              const userAns = selectedAnswers[idx];
              const correct = userAns === q.correct_answer;
              return (
                <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${correct ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-red-500/30 bg-red-900/10'}`}>
                  {correct
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    : <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className="text-slate-300 truncate"><MD text={q.question} /></p>
                    {!correct && (
                      <p className="text-xs text-emerald-400 mt-0.5">
                        {isUrdu ? 'درست جواب:' : 'Correct:'} <MD text={q.correct_answer} />
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setCurrentStep('config'); }}
              className="px-6 py-2.5 rounded-full bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
            >
              {isUrdu ? 'ترتیبات' : 'Back to Config'}
            </button>
            <button
              onClick={() => { setCurrentStep('config'); setTopic(''); }}
              className="px-6 py-2.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white font-medium transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {isUrdu ? 'نیا کوئز' : 'New Quiz'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
