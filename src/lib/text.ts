/** Tiny, safe inline formatter for Hebrew prose: escapes HTML, then `code` and **bold**. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function inline(s: string): string {
  const parts = s.split(/(`[^`]+`)/g);
  return parts
    .map((p) => {
      if (p.length > 1 && p.startsWith('`') && p.endsWith('`')) return `<code class="ic" dir="ltr">${escapeHtml(p.slice(1, -1))}</code>`;
      return bidi(escapeHtml(p)).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    })
    .join('');
}

/** Paragraphs separated by blank lines, single newlines become <br>. */
export function prose(s: string): string {
  return s
    .trim()
    .split(/\n\s*\n/)
    .map((para) => `<p>${inline(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Keeps "C#" (and similar names ending in a neutral char) from flipping to "#C" inside RTL text. */
export const bidi = (s: string) => s.replace(/C#(?!\u200e)/g, 'C#\u200e');

export const bilingual = (he: string, en: string) => bidi(he === en ? he : `${he} - ${en}`);
