import { loadContent, allQuestions } from '../src/lib/content';
import { orderLines, type OrderUnit, type Question } from '../src/lib/schema';
import { acceptedOrders } from '../src/lib/scoring';

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
  /** order questions: wrong arrangements that must NOT print the expected output */
  variants?: string[];
  /** order questions: other accepted arrangements, which must print the expected output */
  accepted?: string[];
}

/**
 * Near-miss arrangements of an `order` question that the site would mark wrong: every move
 * of one line or of a block of up to 4 lines, and every swap of two lines. If one of them
 * prints the same output, the question has a second correct answer: declare it with
 * `anyOrder` or change the code. Also returns the other arrangements the site accepts,
 * which must all print the expected output.
 */
export function orderVariants(code: string, anyOrder?: OrderUnit[][], looksValid: (code: string) => boolean = () => true): { wrong: string[]; accepted: string[] } {
  const lines = orderLines(code);
  const n = lines.length;
  const ok = acceptedOrders(code, anyOrder).map((o) => o.join('\n'));
  const okSet = new Set(ok);
  const wrong = new Set<string>();
  const ident = Array.from({ length: n }, (_, i) => i);
  const add = (o: number[]) => {
    const t = o.map((k) => lines[k]).join('\n');
    if (!okSet.has(t) && looksValid(t)) wrong.add(t);
  };
  for (let len = 1; len <= Math.min(4, n - 1); len++)
    for (let i = 0; i + len <= n; i++)
      for (let j = 0; j <= n - len; j++) {
        if (i === j) continue;
        const o = ident.slice();
        const block = o.splice(i, len);
        o.splice(j, 0, ...block);
        add(o);
      }
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const o = ident.slice();
      [o[i], o[j]] = [o[j], o[i]];
      add(o);
    }
  return { wrong: [...wrong], accepted: ok.slice(1) };
}

const CONTROL = /^(if|else|for|foreach|while|switch|do)\b/;

/**
 * Does C# code look properly indented (4 spaces, Allman braces, brace-less bodies one level
 * deeper)? In C# indentation does not change the meaning, so a scrambled program can run
 * correctly while its lines sit at visibly wrong depths. Learners arrange lines by their look,
 * so such arrangements are not real alternatives and the verifier skips them.
 */
export function csharpIndentOk(code: string): boolean {
  const frames: { ret: number; brace: number; inCase: boolean }[] = [];
  let indent = 0;
  let pending = 0;
  let inCase = false;
  let prev = '';
  // after break/continue/return at block level, the next statement is unreachable
  let dead = false;
  for (const raw of orderLines(code)) {
    const t = raw.trim();
    const actual = raw.length - raw.trimStart().length;
    let expected: number;
    if (t.startsWith('}')) {
      const f = frames.pop();
      if (!f || prev === '{') return false; // no empty blocks
      expected = f.brace;
      indent = f.ret;
      inCase = f.inCase;
      pending = 0;
      dead = false;
    } else if (t === '{') {
      // a block opens only after a header (if/for/method/class...), never as a bare block
      if (!prev || prev.endsWith(';') || prev === '{' || prev.startsWith('}') || prev.endsWith(':')) return false;
      const brace = indent + (inCase ? 4 : 0) + Math.max(0, pending - 1) * 4;
      expected = brace;
      frames.push({ ret: indent, brace, inCase });
      indent = brace + 4;
      pending = 0;
      inCase = false;
    } else if (/^(case\b.*|default\s*):$/.test(t)) {
      expected = indent;
      inCase = true;
      pending = 0;
      dead = false;
    } else {
      if (dead && pending === 0) return false;
      expected = indent + (inCase ? 4 : 0) + pending * 4;
      const jump = /^(break|continue|return)\b/.test(t);
      if (pending === 0 && jump) dead = true;
      if (CONTROL.test(t) && !t.endsWith(';')) pending = t.startsWith('switch') ? 1 : pending + 1;
      else if (t.endsWith(';')) pending = 0;
    }
    if (actual !== expected) return false;
    prev = t;
  }
  return frames.length === 0;
}

/** Problems found from the outputs of [...variants, ...accepted] (null = did not compile/parse). */
export function orderVariantProblems(s: Snippet, outputs: (string | null)[]): string[] {
  const p: string[] = [];
  const nw = s.variants!.length;
  outputs.forEach((o, i) => {
    if (i < nw && o === s.expected)
      p.push(`${s.id}: another order prints the same output, so it would be marked wrong. Declare it with "anyOrder" or change the code:\n${s.variants![i]}`);
    if (i >= nw && o !== s.expected)
      p.push(`${s.id}: an order that "anyOrder" accepts does not print the expected output:\n${s.accepted![i - nw]}\n  prints: ${JSON.stringify(o)}`);
  });
  return p;
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
    } else if ('code' in q && q.code && q.type !== 'order' && !tags.includes('compile-error') && !tags.includes('pseudo')) {
      out.push({ id: q.id, code: q.code, mode: 'syntax' });
    }
    if (q.type === 'order') {
      const expected = normOutput(q.output);
      const v = orderVariants(q.code, q.anyOrder, langId === 'csharp' ? csharpIndentOk : undefined);
      out.push({ id: q.id, code: q.code, expected, options: [expected], mode: 'run', variants: v.wrong, accepted: v.accepted });
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
