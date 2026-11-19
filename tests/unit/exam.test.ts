import { describe, expect, it } from 'vitest';
import { createExam, grade, mistakes, pickQuestions, rng, shuffle, timeLeft } from '../../src/lib/exam';
import { emptyState } from '../../src/lib/storage';
import type { ClientQuestion } from '../../src/lib/types';

const q = (n: number): ClientQuestion =>
  ({ id: `py.c.t.${String(n).padStart(3, '0')}`, type: 'single', difficulty: 1, prompt: 'p', explanation: 'e', options: ['a', 'b', 'c', 'd'], answer: 0, chapter: 'c', topic: 't' }) as ClientQuestion;
const pool = Array.from({ length: 10 }, (_, i) => q(i + 1));

describe('exam', () => {
  it('shuffles deterministically per seed and keeps all items', () => {
    const a = shuffle([1, 2, 3, 4, 5], rng(7));
    expect(shuffle([1, 2, 3, 4, 5], rng(7))).toEqual(a);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('prefers unseen, then wrong, then right questions', () => {
    const s = emptyState();
    for (const x of pool.slice(0, 8)) s.questions[x.id] = { seen: 1, correct: 1, last: '2026-01-01', lastCorrect: true };
    s.questions[pool[0].id].lastCorrect = false;
    const got = pickQuestions(pool, 3, s, rng(1)).map((x) => x.id);
    expect(got.slice(0, 2).sort()).toEqual([pool[8].id, pool[9].id].sort());
    expect(got[2]).toBe(pool[0].id);
  });

  it('lists mistakes newest first', () => {
    const s = emptyState();
    s.questions[pool[1].id] = { seen: 1, correct: 0, last: '2026-01-01', lastCorrect: false };
    s.questions[pool[2].id] = { seen: 1, correct: 0, last: '2026-03-01', lastCorrect: false };
    s.questions[pool[3].id] = { seen: 1, correct: 1, last: '2026-03-01', lastCorrect: true };
    expect(mistakes(pool, s).map((x) => x.id)).toEqual([pool[2].id, pool[1].id]);
  });

  it('creates option orders and grades by original index', () => {
    const now = new Date('2026-01-01T10:00:00Z');
    const ex = createExam({ mode: 'topic', lang: 'python', title: 't', questions: pool.slice(0, 4), feedback: 'end', seed: 3, now, timeLimitSec: 600, passScore: 85 });
    expect(Object.keys(ex.order)).toHaveLength(4);
    for (const o of Object.values(ex.order)) expect([...o].sort()).toEqual([0, 1, 2, 3]);
    ex.answers[pool[0].id] = { kind: 'choice', index: 0 };
    ex.answers[pool[1].id] = { kind: 'choice', index: 1 };
    const byId = Object.fromEntries(pool.map((x) => [x.id, x]));
    const sum = grade(ex, byId, new Date('2026-01-01T10:05:00Z'));
    expect(sum).toMatchObject({ total: 4, correct: 1, score: 25, passed: false, durationSec: 300 });
    expect(timeLeft(ex, new Date('2026-01-01T10:09:00Z'))).toBe(60);
    expect(timeLeft(ex, new Date('2026-01-01T11:00:00Z'))).toBe(0);
  });
});
