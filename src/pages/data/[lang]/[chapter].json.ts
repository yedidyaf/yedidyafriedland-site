import type { APIRoute, GetStaticPaths } from 'astro';
import { getContent } from '../../../lib/content';
import { chapterData } from '../../../lib/build-data';

export const getStaticPaths: GetStaticPaths = () =>
  getContent().flatMap((l) => l.chapters.map((c) => ({ params: { lang: l.id, chapter: c.id } })));

export const GET: APIRoute = async ({ params }) => {
  const lang = getContent().find((l) => l.id === params.lang)!;
  const ch = lang.chapters.find((c) => c.id === params.chapter)!;
  return new Response(JSON.stringify(await chapterData(lang, ch)), { headers: { 'Content-Type': 'application/json' } });
};
