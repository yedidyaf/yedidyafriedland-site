/**
 * Validates all content against the schema and semantic rules.
 * Usage: npm run validate            (structure only)
 *        npm run validate -- --strict (also: every topic has >= 15 questions)
 */
import { loadContent, ContentError } from '../src/lib/content';

const strict = process.argv.includes('--strict') || process.env.CONTENT_STRICT === '1';
try {
  const langs = loadContent({ strict });
  for (const l of langs) {
    const n = l.chapters.reduce((a, c) => a + c.topics.reduce((b, t) => b + t.questions.length, 0), 0);
    console.log(`${l.id}: ${l.chapters.length} chapters, ${n} questions`);
  }
  console.log(`Content OK${strict ? ' (strict)' : ''}.`);
} catch (e) {
  if (e instanceof ContentError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
