import { describe, expect, it } from 'vitest';
import { isComplete, isCorrect, level, mastery, partialScore, readiness } from '../../src/lib/scoring';
import type { Question } from '../../src/lib/schema';

const single = { id: 'py.a.b.001', type: 'single', difficulty: 1, prompt: 'p', explanation: 'e', options: ['a', 'b', 'c'], answer: 2 } as Question;
const tf = { id: 'py.a.b.002', type: 'truefalse', difficulty: 1, prompt: 'p', explanation: 'e', answer: false } as Question;
const bug = { id: 'py.a.b.003', type: 'bug', difficulty: 1, prompt: 'p', explanation: 'e', code: 'a\nb\nc', answer: 2 } as Question;
const match = {
  id: 'py.a.b.004',
  type: 'hierarchy',
  difficulty: 2,
  prompt: 'p',
  explanation: 'e',
  targets: [{ id: 'is-a' }, { id: 'has-a' }],
  items: [
    { label: 'Car ו-Engine', answer: 'has-a' },
    { label: 'Dog ו-Animal', answer: 'is-a' },
  ],
} as Question;

describe('isCorrect', () => {
  it('checks choice answers by original index', () => {
    expect(isCorrect(single, { kind: 'choice', index: 2 })).toBe(true);
    expect(isCorrect(single, { kind: 'choice', index: 0 })).toBe(false);
    expect(isCorrect(single, undefined)).toBe(false);
  });
  it('checks true/false and bug lines', () => {
    expect(isCorrect(tf, { kind: 'bool', value: false })).toBe(true);
    expect(isCorrect(tf, { kind: 'bool', value: true })).toBe(false);
    expect(isCorrect(bug, { kind: 'line', line: 2 })).toBe(true);
    expect(isCorrect(bug, { kind: 'line', line: 3 })).toBe(false);
  });
  it('requires every match item to be right', () => {
    const half = { kind: 'match' as const, picks: { 'Car ו-Engine': 'has-a', 'Dog ו-Animal': 'has-a' } };
    expect(isCorrect(match, half)).toBe(false);
    expect(partialScore(match, half)).toBe(0.5);
    expect(isCorrect(match, { kind: 'match', picks: { 'Car ו-Engine': 'has-a', 'Dog ו-Animal': 'is-a' } })).toBe(true);
  });
  it('treats a partly filled match as incomplete', () => {
    expect(isComplete(match, { kind: 'match', picks: { 'Car ו-Engine': 'has-a' } })).toBe(false);
  });
  it('rejects an answer of the wrong kind', () => {
    expect(isCorrect(single, { kind: 'bool', value: true })).toBe(false);
  });
});

describe('mastery and level', () => {
  it('needs at least 5 answers', () => {
    expect(mastery([1, 1, 1, 1])).toBeNull();
    expect(level([1, 1, 1, 1])).toBe('started');
    expect(level(undefined)).toBe('none');
  });
  it('uses only the last 20 answers', () => {
    expect(mastery([...Array(20).fill(0), ...Array(20).fill(1)])).toBe(100);
  });
  it('maps mastery to levels', () => {
    expect(level([1, 0, 0, 0, 0])).toBe('weak');
    expect(level([1, 1, 1, 1, 0])).toBe('progress');
    expect(level([1, 1, 1, 1, 1, 1, 1])).toBe('mastered');
  });
  it('weights readiness by the blueprint', () => {
    const chapters = [
      { id: 'a', topics: [{ id: 't' }] },
      { id: 'b', topics: [{ id: 't' }] },
    ];
    const r = readiness(chapters, { a: 3, b: 1 }, { 'a/t': [1, 1, 1, 1, 1] }, (c, t) => `${c}/${t}`);
    expect(r).toBe(75);
  });
});
