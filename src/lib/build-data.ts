/** Turns loaded content into the JSON shapes the browser uses. Build-time only. */
import { highlightLines } from './highlight';
import type { LoadedLanguage, LoadedChapter } from './content';
import type { ChapterData, ClientQuestion, LanguageIndex } from './types';

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

export async function clientQuestion(q: LoadedChapter['topics'][number]['questions'][number], chapter: string, topic: string, hl: string): Promise<ClientQuestion> {
  const cq: ClientQuestion = { ...q, chapter, topic };
  if ('code' in q && q.code) cq.codeHtml = await highlightLines(q.code, hl);
  if (q.type === 'cleaner') cq.optionsHtml = await Promise.all(q.options.map((o) => highlightLines(o, hl)));
  if (q.type === 'bug' && q.fixed) cq.fixedHtml = await highlightLines(q.fixed, hl);
  if (q.type === 'architecture')
    cq.itemsHtml = await Promise.all(q.items.map(async (i) => (await highlightLines(i.label, hl)).join(' ')));
  return cq;
}

export async function chapterData(lang: LoadedLanguage, ch: LoadedChapter): Promise<ChapterData> {
  const questions: ClientQuestion[] = [];
  for (const t of ch.topics) for (const q of t.questions) questions.push(await clientQuestion(q, ch.id, t.id, lang.highlight));
  return { lang: lang.id, chapter: ch.id, questions };
}
