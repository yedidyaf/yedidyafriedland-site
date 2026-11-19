/** Answer checking and mastery calculation. Pure functions, shared by browser and tests. */
import type { Question } from './schema';

export type Answer =
  | { kind: 'choice'; index: number } // original (unshuffled) option index
  | { kind: 'bool'; value: boolean }
  | { kind: 'line'; line: number }
  | { kind: 'match'; picks: Record<string, string> }; // item label -> target id

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
  none: 'לא התחלת',
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
