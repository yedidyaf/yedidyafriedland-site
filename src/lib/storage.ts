/**
 * All learner data lives ONLY in this browser, under one localStorage key.
 * Nothing is ever sent to a server. Every access is guarded: if storage is
 * unavailable (private mode, blocked), the site keeps working in memory.
 */
import type { Answer } from './scoring';

export const STORAGE_KEY = 'yf.progress.v1';
export const SCHEMA_VERSION = 1;
export const MAX_FULL_EXAMS = 100;

export interface QuestionStat {
  seen: number;
  correct: number;
  last: string; // ISO date
  lastCorrect: boolean;
}

export interface ExamSummary {
  id: string;
  mode: ExamMode;
  lang: string;
  title: string;
  startedAt: string;
  finishedAt: string;
  durationSec: number;
  total: number;
  correct: number;
  score: number; // 0..100
  passed?: boolean;
  /** omitted for old exams beyond MAX_FULL_EXAMS */
  answers?: { q: string; ok: boolean; a?: Answer }[];
}

export type ExamMode = 'topic' | 'chapter' | 'mixed' | 'simulation' | 'mistakes';

export interface ActiveExam {
  id: string;
  mode: ExamMode;
  lang: string;
  title: string;
  questionIds: string[];
  /** per question: permutation of original option indexes (choice types) */
  order: Record<string, number[]>;
  answers: Record<string, Answer>;
  /** answers confirmed in instant-feedback mode */
  checked: Record<string, boolean>;
  flagged: string[];
  current: number;
  feedback: 'instant' | 'end';
  startedAt: string;
  timeLimitSec?: number;
  passScore?: number;
}

export interface Settings {
  theme: 'auto' | 'light' | 'dark';
  lastLanguage?: string;
}

export interface State {
  schemaVersion: number;
  createdAt: string;
  settings: Settings;
  questions: Record<string, QuestionStat>;
  /** key: `${lang}/${chapter}/${topic}` -> recent results, 1 correct / 0 wrong, newest last */
  topics: Record<string, number[]>;
  exams: ExamSummary[];
  activeExam: ActiveExam | null;
  backupReminderAt?: number; // exams count when last reminded
}

export const topicKey = (lang: string, chapter: string, topic: string) => `${lang}/${chapter}/${topic}`;

export function emptyState(): State {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    settings: { theme: 'auto' },
    questions: {},
    topics: {},
    exams: [],
    activeExam: null,
  };
}

let memory: State | null = null;
let available: boolean | null = null;

export function storageAvailable(): boolean {
  if (available !== null) return available;
  try {
    const k = '__yf_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

/** Bring any older/partial object up to the current schema. */
export function migrate(raw: unknown): State {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<State>;
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : base.createdAt,
    settings: { ...base.settings, ...(r.settings ?? {}) },
    questions: r.questions && typeof r.questions === 'object' ? r.questions : {},
    topics: r.topics && typeof r.topics === 'object' ? r.topics : {},
    exams: Array.isArray(r.exams) ? r.exams : [],
    activeExam: r.activeExam ?? null,
    backupReminderAt: r.backupReminderAt,
  };
}

export function load(): State {
  if (memory) return memory;
  let state = emptyState();
  if (storageAvailable()) {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) state = migrate(JSON.parse(s));
    } catch {
      /* corrupted: start fresh but keep the bad copy for recovery */
      try {
        const bad = localStorage.getItem(STORAGE_KEY);
        if (bad) localStorage.setItem(STORAGE_KEY + '.corrupt', bad);
      } catch {}
    }
  }
  memory = state;
  return state;
}

const listeners = new Set<(s: State) => void>();
export function subscribe(fn: (s: State) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function save(state: State): boolean {
  memory = state;
  let ok = false;
  if (storageAvailable()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      ok = true;
    } catch {
      ok = false;
    }
  }
  listeners.forEach((l) => l(state));
  return ok;
}

export function update(fn: (s: State) => void): State {
  const s = structuredClone(load());
  fn(s);
  save(s);
  return s;
}

/** Re-read from storage (another tab changed it). */
export function reload(): State {
  memory = null;
  return load();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) listeners.forEach((l) => l(reload()));
  });
}

// ---------- recording results ----------

export function recordAnswer(s: State, lang: string, chapter: string, topic: string, qid: string, ok: boolean, when = new Date()) {
  const st = s.questions[qid] ?? { seen: 0, correct: 0, last: '', lastCorrect: false };
  st.seen += 1;
  if (ok) st.correct += 1;
  st.last = when.toISOString();
  st.lastCorrect = ok;
  s.questions[qid] = st;
  const k = topicKey(lang, chapter, topic);
  const arr = s.topics[k] ?? [];
  arr.push(ok ? 1 : 0);
  s.topics[k] = arr.slice(-50);
}

export function pushExam(s: State, summary: ExamSummary) {
  s.exams.push(summary);
  const full = s.exams.length - MAX_FULL_EXAMS;
  for (let i = 0; i < full; i++) delete s.exams[i].answers;
}

// ---------- export / import ----------

export interface ExportFile {
  app: 'yedidyafriedland';
  exportedAt: string;
  checksum: string;
  data: State;
}

/** Small deterministic checksum (FNV-1a) to detect damaged files. Not security. */
export function checksum(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function makeExport(state: State): ExportFile {
  const data = { ...state, activeExam: null };
  return { app: 'yedidyafriedland', exportedAt: new Date().toISOString(), checksum: checksum(JSON.stringify(data)), data };
}

export class ImportError extends Error {}

export function parseImport(text: string): State {
  let obj: ExportFile;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new ImportError('הקובץ אינו קובץ JSON תקין.');
  }
  if (!obj || obj.app !== 'yedidyafriedland' || !obj.data) throw new ImportError('זה לא קובץ גיבוי של האתר.');
  if (checksum(JSON.stringify(obj.data)) !== obj.checksum) throw new ImportError('הקובץ פגום או שנערך ידנית (סכום הביקורת לא תואם).');
  return migrate(obj.data);
}

/** Merge b into a: union of exams by id, per-question stats by latest date, topic histories by longer. */
export function mergeStates(a: State, b: State): State {
  const out = structuredClone(a);
  const ids = new Set(out.exams.map((e) => e.id));
  for (const e of b.exams) if (!ids.has(e.id)) out.exams.push(e);
  out.exams.sort((x, y) => x.startedAt.localeCompare(y.startedAt));
  for (const [k, v] of Object.entries(b.questions)) {
    const cur = out.questions[k];
    if (!cur) out.questions[k] = v;
    else
      out.questions[k] = {
        seen: Math.max(cur.seen, v.seen),
        correct: Math.max(cur.correct, v.correct),
        last: cur.last > v.last ? cur.last : v.last,
        lastCorrect: cur.last > v.last ? cur.lastCorrect : v.lastCorrect,
      };
  }
  for (const [k, v] of Object.entries(b.topics)) {
    const cur = out.topics[k];
    if (!cur || v.length > cur.length) out.topics[k] = v;
  }
  if (b.createdAt < out.createdAt) out.createdAt = b.createdAt;
  return out;
}

export function replaceAll(next: State) {
  save(migrate(next));
}

export function clearAll() {
  memory = emptyState();
  if (storageAvailable()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
  listeners.forEach((l) => l(memory!));
}
