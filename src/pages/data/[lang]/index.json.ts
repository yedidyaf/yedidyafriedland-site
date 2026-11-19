import type { APIRoute, GetStaticPaths } from 'astro';
import { getContent } from '../../../lib/content';
import { languageIndex } from '../../../lib/build-data';

export const getStaticPaths: GetStaticPaths = () => getContent().map((l) => ({ params: { lang: l.id } }));

export const GET: APIRoute = ({ params }) => {
  const lang = getContent().find((l) => l.id === params.lang)!;
  return new Response(JSON.stringify(languageIndex(lang)), { headers: { 'Content-Type': 'application/json' } });
};
