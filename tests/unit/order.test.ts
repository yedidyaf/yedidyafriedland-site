import { describe, expect, it } from 'vitest';
import { isComplete, isCorrect, isOrderCorrect, orderMarks } from '../../src/lib/scoring';
import { rng, scrambleLines } from '../../src/lib/exam';
import { checkQuestion } from '../../src/lib/content';
import type { Question } from '../../src/lib/schema';
import { orderVariants } from '../../scripts/lib';

const code = 'a = 1\nb = 2\nif a < b:\n    print(a)\nelse:\n    print(b)\n';
const q = { id: 'py.a.b.001', type: 'order', difficulty: 1, prompt: 'p', explanation: 'e', code, output: '1', anyOrder: [[1, 2]] } as Question;
const braces = '{\n    x();\n}\n{\n    y();\n}';

describe('order questions', () => {
  it('accepts the correct order and anyOrder permutations', () => {
    expect(isCorrect(q, { kind: 'order', lines: [0, 1, 2, 3, 4, 5] })).toBe(true);
    expect(isCorrect(q, { kind: 'order', lines: [1, 0, 2, 3, 4, 5] })).toBe(true);
    expect(isCorrect(q, { kind: 'order', lines: [0, 1, 2, 5, 4, 3] })).toBe(false);
  });
  it('rejects answers that are not a permutation', () => {
    expect(isCorrect(q, { kind: 'order', lines: [0, 0, 2, 3, 4, 5] })).toBe(false);
    expect(isCorrect(q, { kind: 'order', lines: [0, 1, 2, 3, 4] })).toBe(false);
    expect(isCorrect(q, { kind: 'choice', index: 0 })).toBe(false);
    expect(isComplete(q, undefined)).toBe(false);
  });
  it('treats identical lines as interchangeable', () => {
    expect(isOrderCorrect(braces, [3, 1, 5, 0, 4, 2])).toBe(true);
  });
  it('accepts swapping whole blocks', () => {
    const cls = 'class A:\n    def f(self):\n        return 1\n    def g(self):\n        return 2\nprint(A().f())';
    expect(isOrderCorrect(cls, [0, 3, 4, 1, 2, 5], [[[2, 3], [4, 5]]])).toBe(true);
    expect(isOrderCorrect(cls, [0, 3, 2, 1, 4, 5], [[[2, 3], [4, 5]]])).toBe(false);
  });
  it('handles a group nested inside a unit of another group', () => {
    const two = 'class A:\n    def f(self):\n        return 1\n    def g(self):\n        return 2\nclass B:\n    pass\nprint(A().f())';
    const any = [[[1, 5], [6, 7]], [[2, 3], [4, 5]]] as [number, number][][];
    expect(isOrderCorrect(two, [5, 6, 0, 3, 4, 1, 2, 7], any)).toBe(true);
    expect(isOrderCorrect(two, [0, 3, 4, 1, 2, 5, 6, 7], any)).toBe(true);
    expect(isOrderCorrect(two, [5, 0, 6, 1, 2, 3, 4, 7], any)).toBe(false);
  });
  it('marks lines in place', () => {
    expect(orderMarks(code, [0, 1, 2, 5, 4, 3], [[1, 2]])).toEqual([true, true, true, false, true, false]);
    expect(orderMarks(code, [1, 0, 2, 3, 4, 5], [[1, 2]]).every(Boolean)).toBe(true);
  });
  it('never starts from a correct order', () => {
    for (let seed = 0; seed < 200; seed++) {
      const o = scrambleLines(code, [[1, 2]], rng(seed));
      expect([...o].sort()).toEqual([0, 1, 2, 3, 4, 5]);
      expect(isOrderCorrect(code, o, [[1, 2]])).toBe(false);
    }
  });
  it('validates line count, blank lines and anyOrder blocks', () => {
    const bad = { ...q, code: 'a = 1\n\nprint(a)', anyOrder: [[1, 3]] } as Question;
    const p = checkQuestion(bad, 'f', 'py.a.b').join('\n');
    expect(p).toContain('4-18 lines');
    expect(p).toContain('blank lines');
    expect(p).toContain('adjacent');
    expect(checkQuestion(q, 'f', 'py.a.b')).toEqual([]);
  });
  it('lists near-miss wrong orders and the anyOrder ones for the verifier', () => {
    const v = orderVariants(code, [[1, 2]]);
    expect(v.accepted).toEqual(['b = 2\na = 1\nif a < b:\n    print(a)\nelse:\n    print(b)']);
    expect(v.wrong).not.toContain(v.accepted[0]);
    expect(v.wrong).not.toContain(code.trimEnd());
    expect(v.wrong.length).toBeGreaterThan(10);
  });
});
