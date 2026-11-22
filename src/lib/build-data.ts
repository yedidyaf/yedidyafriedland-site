/** Turns loaded content into the JSON shapes the browser uses. Build-time only. */
import { prepareLine } from './codewrap';
import { highlightLines } from './highlight';
import type { LoadedLanguage, LoadedChapter } from './content';
import type { ChapterData, ClientQuestion, LanguageIndex } from './types';

export const isMultiline = (s: string) => s.trim().includes('\n');

export function languageIndex(lang: LoadedLanguage): LanguageIndex {
  return {
    id: lang.id,
    prefix: lang.prefix,
    title_he: lang.title_he,
    title_en: lang.title_en,
    highlight: lang.highlight,
    simulation: lang.simulation,
    chapters: lang.chapters.map((c) => ({
      id: c.id,
      title_he: c.title_he,
      title_en: c.title_en,
      topics: c.topics.map((t) => ({ id: t.id, title_he: t.title_he, title_en: t.title_en, questionIds: t.questions.map((q) => q.id) })),
    })),
  };
}

/**
 * Architecture labels are one-line strings. A Python label like
 * "class Repo(Protocol): def get(self, id: int) -> Item" stands for a class header and
 * its method, so it is shown as the two lines (with indentation) it would be in a file.
 */
export function labelSource(label: string, hl: string): string {
  if (hl !== 'python') return label;
  const m = /^(class\s+[^:]+:)\s+((?:async\s+)?def\s.+)$/.exec(label.trim());
  return m ? `${m[1]}\n    ${m[2]}` : label;
}

export async function clientQuestion(q: LoadedChapter['topics'][number]['questions'][number], chapter: string, topic: string, hl: string): Promise<ClientQuestion> {
  const cq: ClientQuestion = { ...q, chapter, topic };
  if ('code' in q && q.code) cq.codeHtml = await highlightLines(q.code, hl);
  if (q.type === 'cleaner') cq.optionsHtml = await Promise.all(q.options.map((o) => highlightLines(o, hl)));
  // multi-line options of prose types are code snippets: keep their line breaks and indentation
  if ((q.type === 'single' || q.type === 'smell') && q.options.some(isMultiline))
    cq.optionsHtml = await Promise.all(q.options.map((o) => (isMultiline(o) ? highlightLines(o.replace(/\n+$/, ''), hl) : [])));
  if (q.type === 'bug' && q.fixed) cq.fixedHtml = await highlightLines(q.fixed, hl);
  if (q.type === 'architecture')
    cq.itemsHtml = await Promise.all(
      q.items.map(async (i) =>
        (await highlightLines(labelSource(i.label, hl), hl))
          .map((line) => {
            const { ind, html } = prepareLine(line);
            return `<span class="sl" style="--ind:${ind}">${html}</span>`;
          })
          .join(''),
      ),
    );
  return cq;
}

export async function chapterData(lang: LoadedLanguage, ch: LoadedChapter): Promise<ChapterData> {
  const questions: ClientQuestion[] = [];
  for (const t of ch.topics) for (const q of t.questions) questions.push(await clientQuestion(q, ch.id, t.id, lang.highlight));
  return { lang: lang.id, chapter: ch.id, questions };
}
