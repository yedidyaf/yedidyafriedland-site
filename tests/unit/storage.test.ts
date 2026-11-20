import { describe, expect, it } from 'vitest';
import { emptyState, makeExport, mergeStates, migrate, parseImport, pushExam, recordAnswer, ImportError, MAX_FULL_EXAMS } from '../../src/lib/storage';

describe('storage', () => {
  it('migrates garbage to an empty state', () => {
    expect(migrate(null).questions).toEqual({});
    expect(migrate({ exams: 'x' }).exams).toEqual([]);
  });

  it('records answers per question and per topic', () => {
    const s = emptyState();
    recordAnswer(s, 'python', 'basics', 'variables', 'py.basics.variables.001', true);
    recordAnswer(s, 'python', 'basics', 'variables', 'py.basics.variables.001', false);
    expect(s.questions['py.basics.variables.001']).toMatchObject({ seen: 2, correct: 1, lastCorrect: false });
    expect(s.topics['python/basics/variables']).toEqual([1, 0]);
  });

  it('round-trips an export and detects tampering', () => {
    const s = emptyState();
    recordAnswer(s, 'python', 'basics', 'variables', 'q1', true);
    const text = JSON.stringify(makeExport(s));
    expect(parseImport(text).questions.q1.correct).toBe(1);
    const bad = text.replace('"correct":1', '"correct":5');
    expect(() => parseImport(bad)).toThrow(ImportError);
    expect(() => parseImport('not json')).toThrow(ImportError);
    expect(() => parseImport('{"app":"other"}')).toThrow(ImportError);
  });

  it('never exports an open exam', () => {
    const s = emptyState();
    s.activeExam = { id: 'x' } as never;
    expect(makeExport(s).data.activeExam).toBeNull();
  });

  it('merges exams by id and keeps the newest question stat', () => {
    const a = emptyState();
    const b = emptyState();
    a.questions.q = { seen: 1, correct: 1, last: '2026-01-01T00:00:00Z', lastCorrect: true };
    b.questions.q = { seen: 3, correct: 1, last: '2026-02-01T00:00:00Z', lastCorrect: false };
    const ex = { id: 'e1', mode: 'topic', lang: 'python', title: 't', startedAt: '2026-01-01', finishedAt: '2026-01-01', durationSec: 1, total: 1, correct: 1, score: 100 } as const;
    a.exams.push({ ...ex });
    b.exams.push({ ...ex }, { ...ex, id: 'e2', startedAt: '2026-01-02' });
    const m = mergeStates(a, b);
    expect(m.exams.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(m.questions.q).toMatchObject({ seen: 3, lastCorrect: false });
  });

  it('drops answer details of old exams', () => {
    const s = emptyState();
    for (let i = 0; i < MAX_FULL_EXAMS + 2; i++)
      pushExam(s, { id: `e${i}`, mode: 'topic', lang: 'python', title: 't', startedAt: '', finishedAt: '', durationSec: 0, total: 1, correct: 1, score: 100, answers: [] });
    expect(s.exams[0].answers).toBeUndefined();
    expect(s.exams.at(-1)!.answers).toEqual([]);
  });
});
