import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '../../lib/supabase/api';
import { extractRelevantSections } from '../../lib/rag';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * RAG Context Retrieval API
 * 
 * GET: Retrieve relevant document context for AI generation
 * Query params:
 *   - subject: filter by subject
 *   - keywords: comma-separated keywords for relevance matching
 *   - max_length: maximum context length (default: 5000)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const { subject, keywords, max_length } = req.query;

    // Build query
    let query = supabase
      .from('library_content')
      .select('id, file_name, subject, extracted_text, word_count, created_at')
      .not('extracted_text', 'is', null)
      .order('created_at', { ascending: false });

    if (subject) {
      query = query.eq('subject', subject as string);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(200).json({ 
        context: null, 
        message: 'No documents found. Upload textbooks or notes to enable RAG-powered generation.' 
      });
    }

    // Combine all documents (or just most recent few)
    const maxDocs = 5; // Limit to 5 most recent documents
    const documents = data.slice(0, maxDocs);

    let combinedText = documents
      .map(doc => `\n=== ${doc.file_name} (${doc.subject}) ===\n${doc.extracted_text}`)
      .join('\n\n');

    // Extract relevant sections if keywords provided
    if (keywords && typeof keywords === 'string') {
      const keywordArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
      if (keywordArray.length > 0) {
        const maxLen = max_length ? parseInt(max_length as string) : 5000;
        combinedText = extractRelevantSections(combinedText, keywordArray, maxLen);
      }
    }

    // Truncate if still too long
    const maxContextLength = max_length ? parseInt(max_length as string) : 5000;
    if (combinedText.length > maxContextLength) {
      combinedText = combinedText.slice(0, maxContextLength) + '\n\n[... context truncated ...]';
    }

    return res.status(200).json({
      context: combinedText,
      sources: documents.map(d => ({
        id: d.id,
        file_name: d.file_name,
        subject: d.subject,
        word_count: d.word_count
      })),
      total_documents: documents.length
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
