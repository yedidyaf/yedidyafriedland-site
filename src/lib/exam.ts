/** Exam construction and grading. Pure logic, no DOM. */
import type { ClientQuestion, LanguageIndex } from './types';
import type { ActiveExam, ExamMode, ExamSummary, State } from './storage';
import { isCorrect, type Answer } from './scoring';

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks `count` questions, preferring ones the learner has not seen,
 * then ones answered wrong last time, then the rest; random within each group.
 */
export function pickQuestions(pool: ClientQuestion[], count: number, state: State, rand: () => number): ClientQuestion[] {
  const prio = (q: ClientQuestion) => {
    const st = state.questions[q.id];
    if (!st) return 0;
    if (!st.lastCorrect) return 1;
    return 2;
  };
  const shuffled = shuffle(pool, rand);
  return shuffled
    .map((q, i) => ({ q, p: prio(q), i }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .slice(0, count)
    .map((x) => x.q);
}

/** Simulation: draw per chapter according to the blueprint, then shuffle the whole exam. */
export function pickSimulation(index: LanguageIndex, byChapter: Record<string, ClientQuestion[]>, state: State, rand: () => number): ClientQuestion[] {
  const chosen: ClientQuestion[] = [];
  let missing = 0;
  for (const [ch, n] of Object.entries(index.simulation.blueprint)) {
    const pool = byChapter[ch] ?? [];
    const got = pickQuestions(pool, n, state, rand);
    chosen.push(...got);
    missing += n - got.length;
  }
  if (missing > 0) {
    const used = new Set(chosen.map((q) => q.id));
    const rest = Object.values(byChapter).flat().filter((q) => !used.has(q.id));
    chosen.push(...pickQuestions(rest, missing, state, rand));
  }
  return shuffle(chosen, rand);
}

/** Questions whose most recent answer was wrong, most recent first. */
export function mistakes(pool: ClientQuestion[], state: State, limit = 20): ClientQuestion[] {
  return pool
    .filter((q) => state.questions[q.id] && !state.questions[q.id].lastCorrect)
    .sort((a, b) => state.questions[b.id].last.localeCompare(state.questions[a.id].last))
    .slice(0, limit);
}

export function newExamId(rand: () => number = Math.random) {
  return 'e_' + Date.now().toString(36) + Math.floor(rand() * 1e6).toString(36);
}

export function createExam(opts: {
  mode: ExamMode;
  lang: string;
  title: string;
  questions: ClientQuestion[];
  feedback: 'instant' | 'end';
  timeLimitSec?: number;
  passScore?: number;
  seed?: number;
  now?: Date;
}): ActiveExam {
  const rand = rng(opts.seed ?? Date.now());
  const order: Record<string, number[]> = {};
  for (const q of opts.questions) {
    if (q.type === 'single' || q.type === 'output' || q.type === 'smell' || q.type === 'cleaner') {
      order[q.id] = shuffle(q.options.map((_, i) => i), rand);
    }
  }
  return {
    id: newExamId(rand),
    mode: opts.mode,
    lang: opts.lang,
    title: opts.title,
    questionIds: opts.questions.map((q) => q.id),
    order,
    answers: {},
    checked: {},
    flagged: [],
    current: 0,
    feedback: opts.feedback,
    startedAt: (opts.now ?? new Date()).toISOString(),
    timeLimitSec: opts.timeLimitSec,
    passScore: opts.passScore,
  };
}

export function grade(exam: ActiveExam, byId: Record<string, ClientQuestion>, now = new Date()): ExamSummary {
  const answers = exam.questionIds.map((id) => {
    const q = byId[id];
    const a: Answer | undefined = exam.answers[id];
    return { q: id, ok: q ? isCorrect(q, a) : false, a };
  });
  const correct = answers.filter((x) => x.ok).length;
  const total = answers.length;
  const score = total ? Math.round((100 * correct) / total) : 0;
  return {
    id: exam.id,
    mode: exam.mode,
    lang: exam.lang,
    title: exam.title,
    startedAt: exam.startedAt,
    finishedAt: now.toISOString(),
    durationSec: Math.max(0, Math.round((now.getTime() - new Date(exam.startedAt).getTime()) / 1000)),
    total,
    correct,
    score,
    passed: exam.passScore !== undefined ? score >= exam.passScore : undefined,
    answers,
  };
}

/** Seconds left, or null when untimed. */
export function timeLeft(exam: ActiveExam, now = new Date()): number | null {
  if (!exam.timeLimitSec) return null;
  const elapsed = (now.getTime() - new Date(exam.startedAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(exam.timeLimitSec - elapsed));
}
