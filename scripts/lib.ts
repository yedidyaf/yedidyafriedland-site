import { loadContent, allQuestions } from '../src/lib/content';
import type { Question } from '../src/lib/schema';

/** Normalize program output for comparison: unify newlines, strip trailing spaces and blank lines. */
export function normOutput(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
}

export interface Snippet {
  id: string;
  code: string;
  expected?: string;
  options?: string[];
  mode: 'run' | 'syntax' | 'compile-error';
}

/** Collect code snippets of one language that the verifiers check. */
export function collectSnippets(langId: string): Snippet[] {
  const lang = loadContent().find((l) => l.id === langId);
  if (!lang) throw new Error(`language ${langId} not found`);
  const out: Snippet[] = [];
  for (const { q } of allQuestions(lang)) {
    const tags = q.tags ?? [];
    if (q.type === 'output') {
      out.push({
        id: q.id,
        code: q.code,
        expected: normOutput(q.options[q.answer]),
        options: q.options.map(normOutput),
        mode: tags.includes('compile-error') ? 'compile-error' : 'run',
      });
    } else if ('code' in q && q.code && !tags.includes('compile-error') && !tags.includes('pseudo')) {
      out.push({ id: q.id, code: q.code, mode: 'syntax' });
    }
    if (q.type === 'bug' && q.fixed) out.push({ id: q.id + '#fixed', code: q.fixed, mode: 'syntax' });
    if (q.type === 'cleaner' && !tags.includes('pseudo'))
      q.options.forEach((o, i) => out.push({ id: `${q.id}#option${i}`, code: o, mode: 'syntax' }));
  }
  return out;
}

export function report(kind: string, failures: string[], total: number): never {
  if (failures.length) {
    console.error(`\n${kind}: ${failures.length} of ${total} snippets failed:\n`);
    for (const f of failures) console.error('- ' + f + '\n');
    process.exit(1);
  }
  console.log(`${kind}: all ${total} snippets passed.`);
  process.exit(0);
}

export type { Question };
