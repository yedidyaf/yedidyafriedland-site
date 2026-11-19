/** Build-time syntax highlighting with Shiki, dual theme via CSS variables, split per line. */
import { createHighlighter, type Highlighter } from 'shiki';
import { escapeHtml } from './text';
import type { CodeLines } from './types';

let hl: Promise<Highlighter> | null = null;
function highlighter() {
  hl ??= createHighlighter({ themes: ['github-light', 'github-dark'], langs: ['python', 'csharp'] });
  return hl;
}

export async function highlightLines(code: string, lang: string): Promise<CodeLines> {
  const h = await highlighter();
  const src = code.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  const { tokens } = h.codeToTokens(src, { lang: lang as 'python', themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false });
  return tokens.map((line) =>
    line
      .map((t) => {
        const st = t.htmlStyle ? Object.entries(t.htmlStyle).map(([k, v]) => `${k}:${v}`).join(';') : '';
        return st ? `<span style="${st}">${escapeHtml(t.content)}</span>` : escapeHtml(t.content);
      })
      .join(''),
  );
}
