/** Browser-side loading of the generated JSON (cached per page load). */
import { href } from './url';
import type { ChapterData, ClientQuestion, LanguageIndex } from './types';

const cache = new Map<string, Promise<unknown>>();
function getJson<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(href(path)).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
        return r.json();
      }),
    );
  }
  return cache.get(path) as Promise<T>;
}

export const fetchIndex = (lang: string) => getJson<LanguageIndex>(`/data/${lang}/index.json`);
export const fetchChapter = (lang: string, chapter: string) => getJson<ChapterData>(`/data/${lang}/${chapter}.json`);

export async function fetchChapters(lang: string, chapters: string[]): Promise<Record<string, ClientQuestion[]>> {
  const data = await Promise.all(chapters.map((c) => fetchChapter(lang, c)));
  return Object.fromEntries(data.map((d) => [d.chapter, d.questions]));
}

export function topicTitle(index: LanguageIndex, chapter: string, topic: string): { he: string; en: string } {
  const ch = index.chapters.find((c) => c.id === chapter);
  const t = ch?.topics.find((x) => x.id === topic);
  return { he: t?.title_he ?? topic, en: t?.title_en ?? topic };
}
