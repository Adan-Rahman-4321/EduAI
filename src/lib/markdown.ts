/**
 * EduAI — shared Markdown → HTML renderer (no external deps)
 *
 * Supports:
 *  - # / ## / ### headings
 *  - **bold**, *italic*, `inline code`
 *  - ``` fenced code blocks (with optional language label)
 *  - Unordered lists  (- item)
 *  - Ordered lists    (1. item)
 *  - > blockquotes
 *  - --- horizontal rules
 *  - Paragraphs (blank-line separated)
 *  - Line breaks within paragraphs
 *
 * Processes line-by-line so block elements are never nested inside <p>,
 * which avoids silent DOM restructuring in browsers.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline formatting: bold, italic, code, links */
function inline(raw: string): string {
  return escapeHtml(raw)
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em class="italic text-slate-300">$1</em>')
    .replace(/`(.+?)`/g,       '<code class="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-sky-300 text-[0.85em] font-mono">$1</code>');
}

export function renderMarkdown(md: string): string {
  if (!md) return '';

  const lines = md.split('\n');
  const out: string[] = [];

  let inParagraph   = false;
  let inUl          = false;
  let inOl          = false;
  let inBlockquote  = false;
  let inCodeBlock   = false;
  let codeLang      = '';

  const closeParagraph = () => {
    if (inParagraph) { out.push('</p>'); inParagraph = false; }
  };
  const closeUl = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
  };
  const closeOl = () => {
    if (inOl) { out.push('</ol>'); inOl = false; }
  };
  const closeBlockquote = () => {
    if (inBlockquote) { out.push('</blockquote>'); inBlockquote = false; }
  };
  const closeAll = () => {
    closeParagraph();
    closeUl();
    closeOl();
    closeBlockquote();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── Fenced code block ──────────────────────────────────────────────────
    if (!inCodeBlock && /^```/.test(line)) {
      closeAll();
      codeLang = line.slice(3).trim();
      inCodeBlock = true;
      out.push(
        `<pre class="bg-slate-900 border border-slate-700 rounded-xl p-4 overflow-x-auto my-4"><code class="text-sm font-mono text-slate-200 whitespace-pre">`
      );
      if (codeLang) {
        out.push(`<span class="text-xs text-slate-500 block mb-2">${escapeHtml(codeLang)}</span>`);
      }
      continue;
    }
    if (inCodeBlock) {
      if (/^```/.test(line)) {
        inCodeBlock = false;
        out.push('</code></pre>');
      } else {
        out.push(escapeHtml(line) + '\n');
      }
      continue;
    }

    // ── Horizontal rule ────────────────────────────────────────────────────
    if (/^---+$/.test(line.trim())) {
      closeAll();
      out.push('<hr class="border-slate-700 my-6"/>');
      continue;
    }

    // ── Blank line ─────────────────────────────────────────────────────────
    if (line.trim() === '') {
      closeAll();
      continue;
    }

    // ── Headings ───────────────────────────────────────────────────────────
    const h1 = line.match(/^# (.+)$/);
    if (h1) {
      closeAll();
      out.push(`<h1 class="text-2xl font-bold text-white mt-8 mb-4 pb-2 border-b border-slate-700">${inline(h1[1])}</h1>`);
      continue;
    }
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      closeAll();
      out.push(`<h2 class="text-xl font-bold text-sky-400 mt-7 mb-3 pb-1.5 border-b border-slate-700/60">${inline(h2[1])}</h2>`);
      continue;
    }
    const h3 = line.match(/^### (.+)$/);
    if (h3) {
      closeAll();
      out.push(`<h3 class="text-lg font-bold text-purple-300 mt-6 mb-2">${inline(h3[1])}</h3>`);
      continue;
    }
    const h4 = line.match(/^#### (.+)$/);
    if (h4) {
      closeAll();
      out.push(`<h4 class="text-base font-semibold text-slate-200 mt-5 mb-2">${inline(h4[1])}</h4>`);
      continue;
    }

    // ── Blockquote ─────────────────────────────────────────────────────────
    const bq = line.match(/^> (.+)$/);
    if (bq) {
      closeParagraph(); closeUl(); closeOl();
      if (!inBlockquote) {
        out.push('<blockquote class="border-l-4 border-sky-500 pl-4 my-4 italic text-slate-300 bg-slate-800/30 py-2 pr-2 rounded-r-lg">');
        inBlockquote = true;
      }
      out.push(`<p class="mb-1">${inline(bq[1])}</p>`);
      continue;
    }
    if (inBlockquote && !/^>/.test(line)) {
      closeBlockquote();
    }

    // ── Unordered list ─────────────────────────────────────────────────────
    const ulItem = line.match(/^[-*+] (.+)$/);
    if (ulItem) {
      closeParagraph(); closeOl(); closeBlockquote();
      if (!inUl) {
        out.push('<ul class="list-disc list-inside space-y-1.5 my-3 ml-2">');
        inUl = true;
      }
      out.push(`<li class="text-slate-300 leading-relaxed">${inline(ulItem[1])}</li>`);
      continue;
    }

    // ── Ordered list ───────────────────────────────────────────────────────
    const olItem = line.match(/^(\d+)\. (.+)$/);
    if (olItem) {
      closeParagraph(); closeUl(); closeBlockquote();
      if (!inOl) {
        out.push('<ol class="list-decimal list-inside space-y-1.5 my-3 ml-2">');
        inOl = true;
      }
      out.push(`<li class="text-slate-300 leading-relaxed">${inline(olItem[2])}</li>`);
      continue;
    }

    // ── Plain paragraph / line ────────────────────────────────────────────
    closeUl(); closeOl(); closeBlockquote();
    if (!inParagraph) {
      out.push('<p class="text-slate-300 leading-relaxed my-2">');
      inParagraph = true;
    } else {
      out.push('<br/>');
    }
    out.push(inline(line));
  }

  closeAll();
  return out.join('');
}

/**
 * Inline-only variant — strips block syntax, just renders bold/italic/code.
 * Use for short strings like quiz question text or flashcard faces where
 * you don't want full block-level HTML.
 */
export function renderInlineMarkdown(text: string): string {
  if (!text) return '';
  return inline(text.replace(/\n/g, ' '));
}
