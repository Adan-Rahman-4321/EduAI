import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { extractTextFromBuffer, validateUploadedFile, cleanExtractedText, generateDocumentSummary } from '@/lib/rag';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const extractText = data.get('extract_text') === 'true'; // Optional: extract for RAG
    const subject = data.get('subject') as string | null;
    const userId = data.get('user_id') as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file
    const validation = validateUploadedFile(file.name, file.size);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure filename is safe and unique
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${uniqueSuffix}-${originalName}`;
    
    // Save to public/uploads
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    const filepath = path.join(uploadDir, filename);
    
    try {
      await writeFile(filepath, buffer);
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        const { mkdir } = await import('fs/promises');
        await mkdir(uploadDir, { recursive: true });
        await writeFile(filepath, buffer);
      } else {
        throw e;
      }
    }

    const fileUrl = `/uploads/${filename}`;
    let extractedContent = null;
    let documentSummary = null;

    // ── RAG: Extract text content if requested ──
    if (extractText) {
      try {
        const content = await extractTextFromBuffer(buffer, file.name, file.type);
        const cleanedText = cleanExtractedText(content.text);
        extractedContent = cleanedText;
        documentSummary = generateDocumentSummary(content);

        console.log(`[Upload] ✅ Extracted ${content.metadata.wordCount} words from ${file.name}`);

        // Store extracted content in library_content table for RAG retrieval
        if (subject && userId) {
          const { error: dbError } = await supabase
            .from('library_content')
            .insert([{
              file_name: file.name,
              file_url: fileUrl,
              subject,
              uploaded_by: userId,
              extracted_text: cleanedText,
              word_count: content.metadata.wordCount,
              file_type: content.metadata.type
            }]);

          if (dbError) {
            console.error('[Upload] Failed to store extracted content:', dbError);
          } else {
            console.log('[Upload] ✅ Stored extracted content in database for RAG');
          }
        }
      } catch (e: any) {
        console.error('[Upload] Text extraction failed:', e.message);
        // Continue with file upload even if extraction fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      file_url: fileUrl,
      extracted_content: extractedContent,
      document_summary: documentSummary
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
