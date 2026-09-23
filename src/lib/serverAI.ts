// ─────────────────────────────────────────────────────────────────────────────
// EduAI — serverAI.ts
// AI pipeline: Gemini (primary)  →  OpenRouter / Nemotron (fallback)
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────────────

export type TutorRequest = {
  prompt: string;
  language?: 'EN' | 'UR';
};

export type TutorResponse = {
  reply: string;
  reasoning?: string;
};

export type FlashcardRequest = {
  subject: string;
  topic: string;
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  language?: 'EN' | 'UR';
  context?: string;
};

export type Flashcard = {
  front_en: string;
  back_en: string;
  front_ur?: string;
  back_ur?: string;
};

export type AssignmentRequest = {
  subject: string;
  topic: string;
  type: 'essay' | 'mcq' | 'short-answer' | 'practical';
  difficulty?: 'easy' | 'medium' | 'hard';
  language?: 'EN' | 'UR';
  context?: string;
};

export type QuizRequest = {
  subject: string;
  topic: string;
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionType?: 'mcq' | 'true-false' | 'short-answer';
  language?: 'EN' | 'UR';
  context?: string;
  studentWeakAreas?: string[];
};

export type QuizQuestion = {
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  difficulty: string;
};

export type NotesRequest = {
  subject: string;
  topic: string;
  chapter?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  language?: 'EN' | 'UR';
  context?: string;
};

// ── System prompt ─────────────────────────────────────────────────────────────

function getSystemPrompt(language?: 'EN' | 'UR'): string {
  return language === 'UR'
    ? `آپ ایک تعلیمی ٹیوٹر اسسٹنٹ ہیں۔ واضح، جامع قدم بہ قدم وضاحتیں فراہم کریں۔ اردو میں جواب دیں۔ Pakistan Punjab Textbook Board (PTB) اور FBISE نصاب پر توجہ دیں۔`
    : `You are an educational tutor assistant for Pakistani students studying PTB and FBISE curricula. Provide clear, concise step-by-step explanations with a friendly, encouraging tone. Use simple English.`;
}

// ── Provider 1: Gemini ────────────────────────────────────────────────────────

async function callGeminiAPI(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  modelOverride?: string,
  maxOutputTokens = 3000
): Promise<string> {
  const models = modelOverride
    ? [modelOverride]
    : ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];

  let lastError = '';

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    try {
      console.log(`[EduAI] Trying Gemini model: ${model}`);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n${prompt}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens, topP: 0.95 },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = `Gemini ${model} ${res.status}: ${errText.slice(0, 200)}`;
        console.warn(`[EduAI] ${lastError}`);
        continue; // always try next model / fall through to OpenRouter
      }

      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text && text.trim().length > 0) {
        console.log(`[EduAI] ✅ Gemini ${model} OK (${text.length} chars)`);
        return text.trim();
      }

      if (data?.candidates?.[0]?.finishReason === 'SAFETY') {
        return "I'm sorry, I can't answer that question. Please try rephrasing it.";
      }

      lastError = `Gemini ${model} returned empty/unexpected response`;
      continue;

    } catch (e: any) {
      lastError = e.name === 'AbortError' || e.name === 'TimeoutError'
        ? `Gemini ${model} timed out`
        : (e.message || 'fetch error');
      console.warn(`[EduAI] Gemini ${model} error:`, lastError);
      continue; // never rethrow inside the loop
    }
  }

  throw new Error(`All Gemini models failed. Last: ${lastError}`);
}

// ── Provider 2: OpenRouter (Nemotron fallback) ────────────────────────────────

async function callOpenRouterAPI(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  maxTokens = 1024,
  temperature = 0.3
): Promise<string> {
  const model = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b';
  console.log(`[EduAI] Trying OpenRouter model: ${model}`);

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'EduAI Platform',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new Error('OpenRouter returned empty response');

  console.log(`[EduAI] ✅ OpenRouter (${model}) OK (${text.length} chars)`);
  return text;
}

// ── Generic callAI — used by all generation functions ────────────────────────
// Order: Gemini → OpenRouter/Nemotron

async function callAI(
  prompt: string,
  systemPrompt: string,
  maxTokens = 3000
): Promise<string> {
  // 1. Gemini — pass maxTokens so JSON responses are never truncated
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      return await callGeminiAPI(prompt, systemPrompt, geminiKey, undefined, maxTokens);
    } catch (e: any) {
      console.warn('[EduAI] callAI: Gemini failed, trying OpenRouter:', e.message);
    }
  }

  // 2. OpenRouter / Nemotron
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    try {
      return await callOpenRouterAPI(prompt, systemPrompt, openrouterKey, maxTokens, 0.7);
    } catch (e: any) {
      console.error('[EduAI] callAI: OpenRouter failed:', e.message);
      throw new Error(`Both AI providers failed. OpenRouter: ${e.message}`);
    }
  }

  throw new Error(
    'No AI API key configured. Add GEMINI_API_KEY or OPENROUTER_API_KEY to .env.local'
  );
}

// ── Public API: callTutorAI ───────────────────────────────────────────────────

export async function callTutorAI(req: TutorRequest): Promise<TutorResponse> {
  const systemPrompt = getSystemPrompt(req.language);

  // 1. Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const reply = await callGeminiAPI(req.prompt, systemPrompt, geminiKey, process.env.GEMINI_MODEL, 1500);
      return { reply };
    } catch (e: any) {
      console.warn('[EduAI] Tutor: Gemini failed, trying OpenRouter:', e.message);
    }
  }

  // 2. OpenRouter / Nemotron
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    try {
      const reply = await callOpenRouterAPI(req.prompt, systemPrompt, openrouterKey, 1024, 0.3);
      return { reply };
    } catch (e: any) {
      console.error('[EduAI] Tutor: OpenRouter failed:', e.message);
    }
  }

  if (!geminiKey && !openrouterKey) {
    throw new Error('No AI API key configured. Add GEMINI_API_KEY or OPENROUTER_API_KEY to .env.local');
  }

  throw new Error('AI service temporarily unavailable. Both Gemini and OpenRouter failed. Please try again.');
}

// ── Content generation functions ──────────────────────────────────────────────

/**
 * Robustly extract a JSON array from AI output.
 * Handles: extra prose, markdown fences, truncated arrays.
 */
function extractJsonArray(raw: string): unknown[] {
  // 1. Strip markdown fences if present
  let text = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  // 2. Find the first '[' and last ']'
  const start = text.indexOf('[');
  if (start === -1) throw new Error('No JSON array found in AI response');

  let end = text.lastIndexOf(']');

  // 3. If array is truncated (no closing ']'), repair it
  if (end === -1 || end < start) {
    // Find the last complete object boundary '}'
    const lastClose = text.lastIndexOf('}');
    if (lastClose === -1) throw new Error('AI response too short — no complete JSON objects found');
    text = text.slice(start, lastClose + 1) + ']';
    end = text.length - 1;
  } else {
    text = text.slice(start, end + 1);
  }

  // 4. Parse — if still broken, try removing the last incomplete object
  try {
    return JSON.parse(text);
  } catch {
    // Drop the last item (likely truncated) and retry
    const lastComma = text.lastIndexOf(',', text.lastIndexOf('}'));
    if (lastComma > start) {
      try {
        return JSON.parse(text.slice(0, lastComma) + ']');
      } catch {/* fall through */}
    }
    throw new Error(`JSON parse failed even after repair: ${text.slice(-200)}`);
  }
}

export async function generateFlashcards(req: FlashcardRequest): Promise<Flashcard[]> {
  const isUrdu = req.language === 'UR';
  const count = req.count || 10;
  const difficulty = req.difficulty || 'medium';

  const systemPrompt = isUrdu
    ? `آپ ایک تعلیمی مواد تیار کرنے والے ماہر ہیں۔ Pakistan PTB اور FBISE نصاب کے مطابق فلیش کارڈز بنائیں۔`
    : `You are an educational content creator for Pakistani students (PTB & FBISE). Generate clear, accurate flashcards.`;

  const ctx = req.context ? `\n\n=== Reference ===\n${req.context}\n=== End ===\n\n` : '';

  const prompt = isUrdu
    ? `${ctx}موضوع: ${req.subject}\nٹاپک: ${req.topic}\nمشکل: ${difficulty}\n\n${count} فلیش کارڈز JSON میں دیں:\n[{"front_en":"question","back_en":"answer","front_ur":"سوال","back_ur":"جواب"}]`
    : `${ctx}Subject: ${req.subject}\nTopic: ${req.topic}\nDifficulty: ${difficulty}\n\nGenerate exactly ${count} flashcards as JSON array (no markdown, just JSON):\n[{"front_en":"question","back_en":"answer","front_ur":"سوال","back_ur":"جواب"}]`;

  const response = await callAI(prompt, systemPrompt, 3000);
  const items = extractJsonArray(response) as Flashcard[];
  if (items.length === 0) throw new Error('AI returned empty flashcard array');
  return items.slice(0, count);
}

export async function generateAssignment(req: AssignmentRequest): Promise<string> {
  const isUrdu = req.language === 'UR';
  const difficulty = req.difficulty || 'medium';

  const systemPrompt = isUrdu
    ? `آپ ایک تعلیمی اسائنمنٹس بنانے والے ماہر ہیں۔ PTB اور FBISE نصاب کے مطابق اسائنمنٹس تیار کریں۔`
    : `You are an educational assignment creator for PTB and FBISE curricula.`;

  const ctx = req.context ? `\n\n=== Reference ===\n${req.context}\n=== End ===\n\n` : '';
  const typeMap: Record<string, string> = {
    essay: isUrdu ? 'مضمون نما سوالات' : 'Essay-type questions',
    mcq: isUrdu ? 'کثیر الانتخابی سوالات' : 'MCQ with 4 options each',
    'short-answer': isUrdu ? 'مختصر جوابی سوالات' : 'Short answer (2-3 lines)',
    practical: isUrdu ? 'عملی سرگرمیاں' : 'Practical activities',
  };

  const prompt = isUrdu
    ? `${ctx}موضوع: ${req.subject}\nٹاپک: ${req.topic}\nقسم: ${typeMap[req.type]}\nمشکل: ${difficulty}\n\nمکمل اسائنمنٹ Markdown میں تیار کریں (5-8 سوالات، نمبر تقسیم شامل کریں)۔`
    : `${ctx}Subject: ${req.subject}\nTopic: ${req.topic}\nType: ${typeMap[req.type]}\nDifficulty: ${difficulty}\n\nCreate a complete assignment in Markdown with 5-8 questions and marks distribution.`;

  return callAI(prompt, systemPrompt);
}

export async function generateQuiz(req: QuizRequest): Promise<QuizQuestion[]> {
  const isUrdu = req.language === 'UR';
  const count = req.questionCount || 10;
  const difficulty = req.difficulty || 'medium';
  const qType = req.questionType || 'mcq';

  const systemPrompt = isUrdu
    ? `آپ ایک تعلیمی کوئز بنانے والے ماہر ہیں۔ PTB اور FBISE نصاب کے مطابق adaptive quizzes تیار کریں۔`
    : `You are an educational quiz creator for PTB and FBISE curricula. Create adaptive, engaging quizzes.`;

  const ctx = req.context ? `\n\n=== Reference ===\n${req.context}\n=== End ===\n\n` : '';
  const weakAreas = req.studentWeakAreas?.length
    ? `\n\n=== Weak Areas (focus here) ===\n${req.studentWeakAreas.join(', ')}\n`
    : '';
  const typeMap: Record<string, string> = {
    mcq: 'Multiple choice with 4 options',
    'true-false': 'True/False questions',
    'short-answer': 'Short answer questions',
  };

  const prompt = isUrdu
    ? `${ctx}${weakAreas}موضوع: ${req.subject}\nٹاپک: ${req.topic}\nقسم: ${typeMap[qType]}\nمشکل: ${difficulty}\n\nبالکل ${count} سوالات JSON میں دیں:\n[{"question":"سوال","options":["A","B","C","D"],"correct_answer":"A","explanation":"وضاحت","difficulty":"medium"}]`
    : `${ctx}${weakAreas}Subject: ${req.subject}\nTopic: ${req.topic}\nType: ${typeMap[qType]}\nDifficulty: ${difficulty}\n\nGenerate exactly ${count} questions as JSON array (no markdown, just JSON):\n[{"question":"text","options":["A","B","C","D"],"correct_answer":"A","explanation":"why","difficulty":"medium"}]`;

  const response = await callAI(prompt, systemPrompt, 4000);
  const items = extractJsonArray(response) as QuizQuestion[];
  if (items.length === 0) throw new Error('AI returned empty quiz array');
  return items.slice(0, count);
}

export async function generateNotes(req: NotesRequest): Promise<string> {
  const isUrdu = req.language === 'UR';
  const difficulty = req.difficulty || 'medium';

  const systemPrompt = isUrdu
    ? `آپ ایک ماہر تعلیمی مواد لکھنے والے ہیں۔ PTB اور FBISE نصاب کے مطابق منظم نوٹس Markdown میں تیار کریں۔`
    : `You are an expert educational content writer for Pakistani students (PTB & FBISE). Write clear, structured study notes in Markdown with definitions, formulas, examples, and exam tips.`;

  const ctx = req.context ? `\n\n=== Reference ===\n${req.context}\n=== End ===\n\n` : '';
  const chapterLine = req.chapter
    ? (isUrdu ? `\nباب: ${req.chapter}` : `\nChapter: ${req.chapter}`)
    : '';

  const prompt = isUrdu
    ? `${ctx}مضمون: ${req.subject}${chapterLine}\nٹاپک: ${req.topic}\nمشکل: ${difficulty}\n\nمکمل نوٹس Markdown میں تیار کریں:\n1. تعریف اور تعارف\n2. اہم نکات\n3. فارمولے\n4. مثالیں (کم از کم 2)\n5. امتحان کے اہم نکات`
    : `${ctx}Subject: ${req.subject}${chapterLine}\nTopic: ${req.topic}\nDifficulty: ${difficulty}\n\nGenerate complete Markdown study notes:\n1. Introduction & Definitions\n2. Key Concepts\n3. Formulas/Equations\n4. Worked Examples (at least 2)\n5. Exam Tips (FBISE/PTB focus)`;

  return callAI(prompt, systemPrompt, 3000);
}
