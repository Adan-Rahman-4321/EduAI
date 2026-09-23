/**
 * RAG (Retrieval-Augmented Generation) Helper Functions
 * 
 * These functions extract and process content from uploaded documents
 * to provide context for AI-generated educational content.
 */

export type DocumentType = 'pdf' | 'txt' | 'docx' | 'md' | 'json';

export interface ExtractedContent {
  text: string;
  metadata: {
    fileName: string;
    type: DocumentType;
    pageCount?: number;
    wordCount: number;
    extractedAt: string;
  };
}

/**
 * Extract text content from uploaded file buffer
 * Supports: TXT, MD, JSON (for now - can extend to PDF/DOCX with libraries)
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<ExtractedContent> {
  const detectedType = detectDocumentType(fileName, mimeType);
  
  let text = '';
  
  switch (detectedType) {
    case 'txt':
    case 'md':
      text = buffer.toString('utf-8');
      break;
    
    case 'json':
      try {
        const json = JSON.parse(buffer.toString('utf-8'));
        text = JSON.stringify(json, null, 2);
      } catch {
        text = buffer.toString('utf-8');
      }
      break;
    
    case 'pdf':
      // TODO: Add pdf-parse library for PDF extraction
      throw new Error('PDF extraction not yet implemented. Please use TXT/MD for now.');
    
    case 'docx':
      // TODO: Add mammoth library for DOCX extraction
      throw new Error('DOCX extraction not yet implemented. Please use TXT/MD for now.');
    
    default:
      throw new Error(`Unsupported file type: ${detectedType}`);
  }

  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  return {
    text,
    metadata: {
      fileName,
      type: detectedType,
      wordCount,
      extractedAt: new Date().toISOString()
    }
  };
}

/**
 * Detect document type from filename and MIME type
 */
function detectDocumentType(fileName: string, mimeType?: string): DocumentType {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';
  if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (ext === 'txt' || mimeType === 'text/plain') return 'txt';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'json' || mimeType === 'application/json') return 'json';
  
  return 'txt'; // Default fallback
}

/**
 * Chunk large text into smaller segments for RAG
 * Useful for very large documents that exceed AI token limits
 */
export function chunkText(text: string, maxChunkSize: number = 3000): string[] {
  if (text.length <= maxChunkSize) return [text];
  
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 <= maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      
      // If single paragraph is too large, split by sentences
      if (para.length > maxChunkSize) {
        const sentences = para.split(/[.!?]+\s+/);
        let sentenceChunk = '';
        
        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length + 2 <= maxChunkSize) {
            sentenceChunk += (sentenceChunk ? '. ' : '') + sentence;
          } else {
            if (sentenceChunk) chunks.push(sentenceChunk);
            sentenceChunk = sentence;
          }
        }
        
        if (sentenceChunk) currentChunk = sentenceChunk;
      } else {
        currentChunk = para;
      }
    }
  }
  
  if (currentChunk) chunks.push(currentChunk);
  
  return chunks;
}

/**
 * Extract relevant sections from document based on keywords/topic
 * Useful for targeted RAG - only include relevant portions
 */
export function extractRelevantSections(
  text: string,
  keywords: string[],
  maxLength: number = 5000
): string {
  if (text.length <= maxLength) return text;
  
  const lines = text.split('\n');
  const scoredLines: { line: string; score: number; index: number }[] = [];
  
  // Score each line based on keyword matches
  lines.forEach((line, index) => {
    let score = 0;
    const lowerLine = line.toLowerCase();
    
    keywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      if (lowerLine.includes(lowerKeyword)) {
        score += 10;
      }
      // Partial matches
      const words = lowerLine.split(/\s+/);
      words.forEach(word => {
        if (word.includes(lowerKeyword) || lowerKeyword.includes(word)) {
          score += 1;
        }
      });
    });
    
    scoredLines.push({ line, score, index });
  });
  
  // Sort by score descending
  scoredLines.sort((a, b) => b.score - a.score);
  
  // Take top scored lines up to maxLength
  const selectedLines = scoredLines
    .filter(item => item.score > 0)
    .slice(0, 50) // Max 50 most relevant lines
    .sort((a, b) => a.index - b.index) // Restore original order
    .map(item => item.line);
  
  let result = selectedLines.join('\n');
  
  // Truncate if still too long
  if (result.length > maxLength) {
    result = result.slice(0, maxLength) + '\n\n[... content truncated for length ...]';
  }
  
  return result || text.slice(0, maxLength); // Fallback to first N chars if no keywords match
}

/**
 * Generate a summary of the document content
 * Useful for showing users what was extracted
 */
export function generateDocumentSummary(content: ExtractedContent): string {
  const { text, metadata } = content;
  const preview = text.slice(0, 500).trim() + (text.length > 500 ? '...' : '');
  
  return `Document: ${metadata.fileName}
Type: ${metadata.type.toUpperCase()}
Word Count: ${metadata.wordCount}
Extracted: ${new Date(metadata.extractedAt).toLocaleString()}

Preview:
${preview}`;
}

/**
 * Validate uploaded file before processing
 */
export function validateUploadedFile(
  fileName: string,
  fileSize: number,
  maxSizeMB: number = 10
): { valid: boolean; error?: string } {
  // Check file extension
  const ext = fileName.split('.').pop()?.toLowerCase();
  const allowedExtensions = ['txt', 'md', 'json']; // Extend when PDF/DOCX support added
  
  if (!ext || !allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file type. Allowed: ${allowedExtensions.join(', ')}`
    };
  }
  
  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (fileSize > maxSizeBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSizeMB}MB`
    };
  }
  
  return { valid: true };
}

/**
 * Clean and normalize extracted text
 * Removes excessive whitespace, special characters, etc.
 */
export function cleanExtractedText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Remove leading/trailing whitespace
    .trim();
}
