/** Answer checking and mastery calculation. Pure functions, shared by browser and tests. */
import { orderLines, type OrderUnit, type Question } from './schema';

export type Answer =
  | { kind: 'choice'; index: number } // original (unshuffled) option index
  | { kind: 'bool'; value: boolean }
  | { kind: 'line'; line: number }
  | { kind: 'match'; picks: Record<string, string> } // item label -> target id
  | { kind: 'order'; lines: number[] }; // arranged order, as 0-based indexes into the correct code's lines

/** Is `order` a permutation of 0..n-1? */
function isPermutation(order: number[], n: number): boolean {
  if (order.length !== n) return false;
  const seen = new Set(order);
  return seen.size === n && order.every((v) => Number.isInteger(v) && v >= 0 && v < n);
}

export function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((r) => [x, ...r]));
}

/** 0-based line indexes of a unit (a line number or an inclusive [from, to] range, 1-based). */
export function unitLines(u: OrderUnit): number[] {
  const [a, b] = typeof u === 'number' ? [u, u] : u;
  return Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i);
}

/**
 * Every correct arrangement of an `order` question, as lists of line texts. A group may be
 * nested inside one unit of another group (two methods that may swap, inside a class that may
 * swap with another class). Lines are compared
 * by text, so identical lines (two closing braces) are interchangeable.
 */
export function acceptedOrders(code: string, anyOrder: OrderUnit[][] = []): string[][] {
  const lines = orderLines(code);
  let orders: number[][] = [lines.map((_, i) => i)];
  // inner groups first: a group nested inside a unit of another group moves with that unit
  const groups = anyOrder.map((g) => g.map(unitLines)).sort((a, b) => a.flat().length - b.flat().length);
  for (const blocks of groups) {
    const start = blocks[0][0];
    const len = blocks.reduce((n, b) => n + b.length, 0);
    orders = orders.flatMap((o) =>
      permutations(blocks).map((perm) => {
        const next = o.slice();
        next.splice(start, len, ...perm.flatMap((b) => b.map((pos) => o[pos])));
        return next;
      }),
    );
  }
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const o of orders) {
    const text = o.map((i) => lines[i]);
    const key = text.join('\n');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(text);
    }
  }
  return out;
}

/** Per position of an `order` answer: does it hold the right line (against the closest correct order)? */
export function orderMarks(code: string, arranged: number[], anyOrder?: OrderUnit[][]): boolean[] {
  const lines = orderLines(code);
  const got = arranged.map((i) => lines[i]);
  let best: boolean[] = [];
  let bestN = -1;
  for (const ok of acceptedOrders(code, anyOrder)) {
    const marks = ok.map((l, i) => l === got[i]);
    const n = marks.filter(Boolean).length;
    if (n > bestN) [best, bestN] = [marks, n];
  }
  return best;
}

/** Is this arrangement a correct program? */
export function isOrderCorrect(code: string, arranged: number[], anyOrder?: OrderUnit[][]): boolean {
  return isPermutation(arranged, orderLines(code).length) && orderMarks(code, arranged, anyOrder).every(Boolean);
}

export function isComplete(q: Question, a: Answer | undefined): boolean {
  if (!a) return false;
  if (a.kind === 'match' && (q.type === 'architecture' || q.type === 'hierarchy')) return q.items.every((i) => a.picks[i.label] !== undefined);
  return true;
}

export function isCorrect(q: Question, a: Answer | undefined): boolean {
  if (!a) return false;
  switch (q.type) {
    case 'single':
    case 'output':
    case 'smell':
    case 'cleaner':
      return a.kind === 'choice' && a.index === q.answer;
    case 'truefalse':
      return a.kind === 'bool' && a.value === q.answer;
    case 'bug':
      return a.kind === 'line' && a.line === q.answer;
    case 'architecture':
    case 'hierarchy':
      return a.kind === 'match' && q.items.every((i) => a.picks[i.label] === i.answer);
    case 'order':
      return a.kind === 'order' && isOrderCorrect(q.code, a.lines, q.anyOrder);
  }
}

/** Fraction 0..1 of correct placements (match questions); 0/1 for the rest. */
export function partialScore(q: Question, a: Answer | undefined): number {
  if ((q.type === 'architecture' || q.type === 'hierarchy') && a?.kind === 'match') {
    return q.items.filter((i) => a.picks[i.label] === i.answer).length / q.items.length;
  }
  return isCorrect(q, a) ? 1 : 0;
}

export const RECENT_WINDOW = 20;
export const MIN_FOR_MASTERY = 5;

/** Mastery 0..100 from the most recent answers (1 = correct, 0 = wrong), or null if too few. */
export function mastery(recent: number[]): number | null {
  if (recent.length < MIN_FOR_MASTERY) return null;
  const w = recent.slice(-RECENT_WINDOW);
  return Math.round((100 * w.reduce((a, b) => a + b, 0)) / w.length);
}

export type Level = 'none' | 'started' | 'weak' | 'progress' | 'mastered';
export function level(recent: number[] | undefined): Level {
  if (!recent || recent.length === 0) return 'none';
  const m = mastery(recent);
  if (m === null) return 'started';
  if (m < 60) return 'weak';
  if (m < 85) return 'progress';
  return 'mastered';
}

export const LEVEL_LABEL: Record<Level, string> = {
  none: 'לא התחלתם',
  started: 'אין מספיק נתונים',
  weak: 'חלש',
  progress: 'בדרך',
  mastered: 'שולט',
};

/** Readiness for the full exam: blueprint-weighted average of chapter mastery (topics with no data count as 0). */
export function readiness(
  chapters: { id: string; topics: { id: string }[] }[],
  blueprint: Record<string, number>,
  topicRecent: Record<string, number[]>,
  topicKey: (chapter: string, topic: string) => string,
): number {
  let total = 0;
  let weight = 0;
  for (const ch of chapters) {
    const w = blueprint[ch.id] ?? 0;
    if (!w || !ch.topics.length) continue;
    const avg = ch.topics.reduce((s, t) => s + (mastery(topicRecent[topicKey(ch.id, t.id)] ?? []) ?? 0), 0) / ch.topics.length;
    total += avg * w;
    weight += w;
  }
  return weight ? Math.round(total / weight) : 0;
}
