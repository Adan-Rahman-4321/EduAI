'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Mic, BookText, Settings2, Sparkles, BrainCircuit, Image as ImageIcon, Paperclip, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { renderMarkdown } from '@/lib/markdown';

interface Message {
  id: number;
  role: 'tutor' | 'student' | 'system';
  type: 'message' | 'reasoning' | 'error';
  content: string;
  urduContent?: string;
}

/** Render basic markdown in tutor chat messages (bold, italic, inline code, line breaks). */
function renderTutorMarkdown(text: string): string {
  return renderMarkdown(text);
}

export default function AITutorChat({ language }: { language: "EN" | "UR" }) {
  const isUrdu = language === "UR";
  
  const [isRecording, setIsRecording] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'tutor',
      type: 'message',
      content: 'Hello! I\'m your AI Tutor powered by advanced language models. I can help you with any doubts in Physics, Math, Chemistry, Biology, and more. Just ask me anything!',
      urduContent: 'سلام! میں آپ کا AI ٹیوٹر ہوں جو جدید زبان کے ماڈلز سے چلتا ہے۔ میں آپ کی فزکس، ریاضی، کیمسٹری، بیالوجی اور مزید موضوعات میں مدد کر سکتا ہوں۔ بس مجھ سے کچھ بھی پوچھیں!'
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    const prompt = inputValue.trim();
    if (!prompt || isSending) return;
    
    setIsSending(true);

    // Add student message
    const studentMsg: Message = { 
      id: Date.now(), 
      role: 'student', 
      type: 'message', 
      content: prompt 
    };
    setMessages((m) => [...m, studentMsg]);
    setInputValue('');

    // Add "thinking" indicator
    const thinkingMsg: Message = {
      id: Date.now() + 1,
      role: 'system',
      type: 'reasoning',
      content: 'AI is analyzing your question and preparing a detailed response...'
    };
    setMessages((m) => [...m, thinkingMsg]);

    try {
      const resp = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, language })
      });

      // Remove thinking indicator
      setMessages((m) => m.filter(msg => msg.id !== thinkingMsg.id));

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${resp.status}`);
      }

      const data = await resp.json();
      
      if (data?.data?.reply) {
        const tutorMsg: Message = { 
          id: Date.now() + 2, 
          role: 'tutor', 
          type: 'message', 
          content: data.data.reply 
        };
        setMessages((m) => [...m, tutorMsg]);
        
        toast.success(isUrdu ? 'جواب موصول ہوا!' : 'Response received!', { 
          icon: '✨',
          duration: 2000 
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (e: any) {
      console.error('Tutor API error:', e);
      
      // Remove thinking indicator if still there
      setMessages((m) => m.filter(msg => msg.id !== thinkingMsg.id));
      
      const errorMsg: Message = { 
        id: Date.now() + 3, 
        role: 'tutor', 
        type: 'error', 
        content: isUrdu 
          ? `معذرت، ایک خرابی پیش آئی: ${e.message}` 
          : `Sorry, I encountered an error: ${e.message}`,
      };
      setMessages((m) => [...m, errorMsg]);
      
      toast.error(isUrdu ? 'خرابی پیش آئی' : 'Error occurred', {
        icon: '❌',
        duration: 3000
      });
    } finally {
      setIsSending(false);
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.success(
      isUrdu 
        ? `تصویر "${file.name}" اپ لوڈ ہو گئی — AI تجزیہ کر رہا ہے!` 
        : `Image "${file.name}" uploaded — AI is analyzing!`,
      { icon: '🖼️', duration: 3500 }
    );

    // TODO: Implement image analysis
    setMessages((m) => [...m, {
      id: Date.now(),
      role: 'tutor',
      type: 'message',
      content: 'Image analysis feature coming soon! For now, please describe your question in text.',
      urduContent: 'تصویر کی تجزیہ کی خصوصیت جلد آ رہی ہے! ابھی کے لیے، براہ کرم اپنا سوال متن میں بیان کریں۔'
    }]);
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      toast(isUrdu ? 'آواز ریکارڈنگ شروع...' : 'Voice recording started...', {
        icon: '🎤',
        duration: 2000
      });
      // TODO: Implement voice recording
      setTimeout(() => {
        setIsRecording(false);
        toast.success(isUrdu ? 'ریکارڈنگ بند' : 'Recording stopped', {
          duration: 2000
        });
      }, 3000);
    }
  };

  return (
    <div className="flex gap-6 h-full min-h-[600px]">
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col glass-card overflow-hidden">
        
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center neon-border-blue">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                AI Tutor <Sparkles className="w-4 h-4 text-sky-400" />
              </h3>
              <p className="text-xs text-sky-300">
                {isSending ? 'Thinking...' : 'Ready to help • Powered by Gemini AI'}
              </p>
            </div>
          </div>
          
          <button className="p-2 text-slate-400 hover:text-sky-400 transition-colors">
            <Settings2 className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
              {msg.type === 'reasoning' ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/40 rounded-lg border border-slate-700/50 text-xs font-mono text-slate-400 animate-pulse">
                  <BrainCircuit className="w-4 h-4 text-purple-400" />
                  {msg.content}
                </div>
              ) : msg.type === 'error' ? (
                <div className="max-w-[80%] rounded-2xl px-5 py-3.5 bg-red-900/20 border border-red-500/30 text-red-200 rounded-bl-none">
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
              ) : (
                <div className={`rounded-2xl px-5 py-3.5 ${
                  msg.role === 'student'
                    ? 'max-w-[80%] bg-sky-600 text-white rounded-br-none'
                    : 'w-full bg-slate-800 border border-slate-700/50 text-slate-200 rounded-bl-none'
                }`}>
                  {msg.role === 'tutor' ? (
                    <div
                      className={`text-sm leading-relaxed prose-invert ${isUrdu && msg.urduContent ? 'font-urdu text-right' : ''}`}
                      dangerouslySetInnerHTML={{
                        __html: renderTutorMarkdown(isUrdu && msg.urduContent ? msg.urduContent : msg.content)
                      }}
                    />
                  ) : (
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isUrdu ? 'font-urdu text-right' : ''}`}>
                      {msg.content}
                    </p>
                  )}
                  
                  {msg.role === 'tutor' && msg.id > 1 && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-wrap gap-2">
                      <button 
                        onClick={() => {
                          setInputValue(isUrdu ? 'مثال دکھائیں' : 'Show me an example');
                        }}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                      >
                        {isUrdu ? 'مثال دکھائیں' : 'Show Example'}
                      </button>
                      <button 
                        onClick={() => {
                          setInputValue(isUrdu ? 'مجھے ایک مشق کا سوال دیں' : 'Give me a practice question');
                        }}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                      >
                        {isUrdu ? 'مشق کا سوال' : 'Practice Question'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 bg-slate-800/30 border-t border-slate-700/50">
          <div className="relative flex items-center">
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload}
            />
            <label 
              htmlFor="file-upload" 
              className="absolute left-3 p-2 text-slate-400 hover:text-sky-400 transition-colors cursor-pointer"
            >
              <Paperclip className="w-5 h-5" />
            </label>
            <button 
              onClick={toggleRecording}
              className={`absolute left-12 p-2 transition-colors ${isRecording ? 'text-red-400 animate-pulse' : 'text-slate-400 hover:text-sky-400'}`}
            >
              <Mic className="w-5 h-5" />
            </button>
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isRecording ? (isUrdu ? "سن رہا ہے..." : "Listening...") : (isUrdu ? "یہاں اپنا سوال لکھیں..." : "Ask your tutor or upload a picture...")}
              className={`w-full bg-slate-900 border ${isRecording ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-slate-700/50'} rounded-xl py-3 pl-24 pr-12 text-sm text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all ${isUrdu ? 'font-urdu text-right pr-4 pl-24' : ''}`}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && inputValue.trim() && !isSending) {
                  e.preventDefault();
                  await sendMessage();
                }
              }}
              disabled={isSending}
            />
            <button 
              onClick={async () => { if (inputValue.trim() && !isSending) await sendMessage(); }}
              disabled={isSending || !inputValue.trim()}
              className={`absolute ${isUrdu ? 'left-3' : 'right-3'} p-2 transition-colors ${isSending || !inputValue.trim() ? 'text-slate-600 cursor-not-allowed' : 'text-sky-400 hover:text-sky-300'}`}
            >
              {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          <div className="flex justify-center gap-4 mt-3">
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> {isUrdu ? 'تصویریں اپ لوڈ کریں' : 'Drag & drop homework pictures'}
            </span>
          </div>
        </div>

      </div>

      {/* Textbook Context Panel */}
      <div className="hidden lg:flex w-80 glass-card flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/50 bg-slate-800/30">
          <h3 className="font-bold text-slate-200 flex items-center gap-2 text-sm">
            <BookText className="w-4 h-4 text-sky-400" />
            {isUrdu ? 'کتاب کا سیاق' : 'Textbook Context'}
          </h3>
        </div>
        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">PTB Math Class 10</span>
              <span className="text-xs text-slate-400">Chapter 4</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              &quot;A quadratic equation in one variable is an equation that can be written in the form ax² + bx + c = 0, where a, b, and c are real numbers and a ≠ 0.&quot;
            </p>
          </div>
          
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
               {isUrdu ? 'تجویز کردہ تصورات' : 'Suggested Concepts'}
             </h4>
             <ul className="flex flex-col gap-2">
                <li className="text-sm text-slate-300 flex items-center gap-2 cursor-pointer hover:text-sky-400 transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-500" /> 
                  {isUrdu ? 'فیکٹرنگ کا طریقہ' : 'Factoring Method'}
                </li>
                <li className="text-sm text-slate-300 flex items-center gap-2 cursor-pointer hover:text-sky-400 transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500" /> 
                  {isUrdu ? 'کواڈریٹک فارمولا' : 'Quadratic Formula'}
                </li>
                <li className="text-sm text-slate-300 flex items-center gap-2 cursor-pointer hover:text-sky-400 transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 
                  {isUrdu ? 'مکمل مربع' : 'Completing Square'}
                </li>
             </ul>
          </div>

          <div className="mt-auto p-3 rounded-lg bg-sky-900/20 border border-sky-500/30 text-xs text-sky-200">
            <p className="flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              {isUrdu ? 'AI RAG نظام فعال ہے' : 'AI RAG System Active'}
            </p>
          </div>
        </div>
      </div>
      
    </div>
  );
}
