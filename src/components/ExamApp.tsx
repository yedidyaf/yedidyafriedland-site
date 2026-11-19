/**
 * The exam runner island: builds an exam from URL parameters, runs it,
 * saves progress after every action (so a reload resumes it) and shows results.
 *
 * URL parameters:
 *   lang=python|csharp  mode=topic|chapter|mixed|simulation|mistakes
 *   chapter=<id> topic=<id> chapters=a,b,c count=N feedback=instant|end
 *   result=<examId>  (show a finished exam from history)
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import QuestionCard from './QuestionCard';
import { fetchChapters, fetchIndex, topicTitle } from '../lib/client-data';
import { createExam, grade, mistakes, pickQuestions, pickSimulation, rng, timeLeft } from '../lib/exam';
import { isComplete, isCorrect, type Answer } from '../lib/scoring';
import { load, pushExam, recordAnswer, storageAvailable, update, type ActiveExam, type ExamMode, type ExamSummary } from '../lib/storage';
import { bilingual } from '../lib/text';
import { href } from '../lib/url';
import type { ClientQuestion, LanguageIndex } from '../lib/types';

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty'; message: string; lang?: string }
  | { kind: 'conflict'; pending: ActiveExam; existing: ActiveExam }
  | { kind: 'running' }
  | { kind: 'results'; summary: ExamSummary };

const MODES: ExamMode[] = ['topic', 'chapter', 'mixed', 'simulation', 'mistakes'];
const DEFAULT_COUNT: Record<ExamMode, number> = { topic: 10, chapter: 15, mixed: 20, simulation: 30, mistakes: 20 };
const BACKUP_EVERY = 5;

/** id = prefix.chapter.topic.NNN */
const chapterOf = (id: string) => id.split('.')[1];

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!m) return `${s} שניות`;
  return s ? `${m} דקות ו-${s} שניות` : `${m} דקות`;
}

interface Loaded {
  index: LanguageIndex;
  byId: Record<string, ClientQuestion>;
}

async function loadQuestions(lang: string, chapters: string[]): Promise<Loaded> {
  const index = await fetchIndex(lang);
  const wanted = chapters.length ? chapters : index.chapters.map((c) => c.id);
  const byChapter = await fetchChapters(lang, wanted.filter((c) => index.chapters.some((x) => x.id === c)));
  const byId: Record<string, ClientQuestion> = {};
  for (const qs of Object.values(byChapter)) for (const q of qs) byId[q.id] = q;
  return { index, byId };
}

/** Builds a new exam from URL params, or returns an explanation why it can't. */
async function buildFromParams(p: URLSearchParams): Promise<{ exam: ActiveExam; loaded: Loaded } | { empty: string; lang?: string }> {
  const lang = p.get('lang') ?? '';
  const mode = p.get('mode') as ExamMode;
  if (!lang || !MODES.includes(mode)) return { empty: 'הקישור למבחן חסר או שגוי.' };
  const index = await fetchIndex(lang);
  const chapterId = p.get('chapter') ?? '';
  const topicId = p.get('topic') ?? '';
  const chapterIds =
    mode === 'topic' || mode === 'chapter'
      ? [chapterId]
      : mode === 'mixed' && (p.get('chapters') || p.getAll('ch').length)
        ? [...(p.get('chapters') ?? '').split(','), ...p.getAll('ch')].filter(Boolean)
        : index.chapters.map((c) => c.id);
  const loaded = await loadQuestions(lang, chapterIds);
  const all = Object.values(loaded.byId);
  const state = load();
  const seed = Date.now();
  const rand = rng(seed);
  const count = Math.max(1, Math.min(60, Number(p.get('count')) || DEFAULT_COUNT[mode]));
  let feedback: 'instant' | 'end' = p.get('feedback') === 'end' ? 'end' : 'instant';
  let questions: ClientQuestion[] = [];
  let title = '';
  let timeLimitSec: number | undefined;
  let passScore: number | undefined;
  const langTitle = bilingual(index.title_he, index.title_en);

  switch (mode) {
    case 'topic': {
      const t = topicTitle(index, chapterId, topicId);
      questions = pickQuestions(
        all.filter((q) => q.chapter === chapterId && q.topic === topicId),
        count,
        state,
        rand,
      );
      title = bilingual(t.he, t.en);
      break;
    }
    case 'chapter': {
      const ch = index.chapters.find((c) => c.id === chapterId);
      questions = pickQuestions(all.filter((q) => q.chapter === chapterId), count, state, rand);
      title = ch ? bilingual(ch.title_he, ch.title_en) : chapterId;
      break;
    }
    case 'mixed':
      questions = pickQuestions(all, count, state, rand);
      title = `תרגול מעורב - Mixed Practice (${langTitle})`;
      break;
    case 'mistakes':
      questions = mistakes(all, state, count);
      title = `תרגול טעויות - Mistakes (${langTitle})`;
      if (!questions.length) return { empty: 'אין כרגע שאלות שטעיתם בהן. כל הכבוד! נסו מבחן חדש.', lang };
      break;
    case 'simulation': {
      const byChapter: Record<string, ClientQuestion[]> = {};
      for (const q of all) (byChapter[q.chapter] ??= []).push(q);
      questions = pickSimulation(index, byChapter, state, rand).slice(0, index.simulation.questions);
      title = `מבחן סימולציה - Exam Simulation (${langTitle})`;
      feedback = 'end';
      timeLimitSec = index.simulation.minutes * 60;
      passScore = index.simulation.passScore;
      break;
    }
  }
  if (!questions.length) return { empty: 'לא נמצאו שאלות עבור הבחירה הזאת.', lang };
  const exam = createExam({ mode, lang, title, questions, feedback, timeLimitSec, passScore, seed });
  return { exam, loaded };
}

export default function ExamApp() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [exam, setExam] = useState<ActiveExam | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const finishing = useRef(false);

  // ---------- bootstrap ----------
  useEffect(() => {
    (async () => {
      try {
        const p = new URLSearchParams(location.search);
        const resultId = p.get('result');
        const state = load();
        if (resultId) {
          const summary = state.exams.find((e) => e.id === resultId);
          if (!summary) return setPhase({ kind: 'empty', message: 'המבחן הזה לא נמצא בהיסטוריה של הדפדפן הזה.' });
          const chapters = [...new Set((summary.answers ?? []).map((a) => chapterOf(a.q)))];
          setData(await loadQuestions(summary.lang, chapters));
          return setPhase({ kind: 'results', summary });
        }
        const existing = state.activeExam;
        if (!p.get('mode')) {
          if (!existing) return setPhase({ kind: 'empty', message: 'אין מבחן פתוח כרגע. בחרו נושא או מבחן חדש מעמוד השפה.' });
          return resume(existing);
        }
        const built = await buildFromParams(p);
        if ('empty' in built) return setPhase({ kind: 'empty', message: built.empty, lang: built.lang });
        setData(built.loaded);
        if (existing && existing.questionIds.some((id) => !(existing.answers[id] === undefined))) {
          return setPhase({ kind: 'conflict', pending: built.exam, existing });
        }
        start(built.exam);
      } catch (e) {
        console.error(e);
        setPhase({ kind: 'error', message: 'טעינת השאלות נכשלה. בדקו את החיבור לאינטרנט ונסו לרענן את הדף.' });
      }
    })();
  }, []);

  async function resume(ex: ActiveExam) {
    const loaded = await loadQuestions(ex.lang, [...new Set(ex.questionIds.map(chapterOf))]);
    // drop questions that no longer exist (content changed since the exam began)
    const ids = ex.questionIds.filter((id) => loaded.byId[id]);
    if (!ids.length) {
      update((s) => (s.activeExam = null));
      return setPhase({ kind: 'empty', message: 'המבחן הפתוח כבר לא תקף. התחילו מבחן חדש.' });
    }
    const fixed = { ...ex, questionIds: ids, current: Math.min(ex.current, ids.length - 1) };
    setData(loaded);
    start(fixed);
  }

  function start(ex: ActiveExam) {
    update((s) => {
      s.activeExam = ex;
      s.settings.lastLanguage = ex.lang;
    });
    // clean the URL so a reload resumes instead of building a new exam
    history.replaceState(null, '', location.pathname);
    setExam(ex);
    setPhase({ kind: 'running' });
  }

  /** Persist and re-render a change to the active exam. */
  function change(fn: (ex: ActiveExam) => void) {
    setExam((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      update((s) => (s.activeExam = next));
      return next;
    });
  }

  // ---------- timer ----------
  useEffect(() => {
    if (phase.kind !== 'running' || !exam?.timeLimitSec) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase.kind, exam?.id]);

  const secondsLeft = exam ? timeLeft(exam, new Date(now)) : null;
  useEffect(() => {
    if (phase.kind === 'running' && secondsLeft === 0) finish();
  }, [secondsLeft, phase.kind]);

  // ---------- finishing ----------
  function finish() {
    if (!exam || !data || finishing.current) return;
    finishing.current = true;
    const summary = grade(exam, data.byId);
    update((s) => {
      for (const id of exam.questionIds) {
        const q = data.byId[id];
        if (!q || exam.checked[id]) continue; // checked answers were recorded already
        if (exam.answers[id] === undefined) continue; // unanswered: not counted toward mastery
        recordAnswer(s, exam.lang, q.chapter, q.topic, id, isCorrect(q, exam.answers[id]));
      }
      pushExam(s, summary);
      s.activeExam = null;
    });
    setConfirmFinish(false);
    setExam(null);
    setPhase({ kind: 'results', summary });
    window.scrollTo({ top: 0 });
  }

  function discardExisting(pending: ActiveExam) {
    update((s) => (s.activeExam = null));
    start(pending);
  }

  // ---------- render ----------
  if (phase.kind === 'loading') return <p class="muted center-pad">טוען שאלות...</p>;
  if (phase.kind === 'error')
    return (
      <div class="notice err" role="alert">
        {phase.message}
      </div>
    );
  if (phase.kind === 'empty')
    return (
      <div class="card center-pad">
        <p>{phase.message}</p>
        <a class="btn" href={href(phase.lang ? `/${phase.lang}/` : '/')}>
          {phase.lang ? 'לעמוד השפה' : 'לעמוד הבית'}
        </a>
      </div>
    );
  if (phase.kind === 'conflict')
    return (
      <div class="card">
        <h2>יש לכם מבחן פתוח</h2>
        <p>
          התחלתם את <strong>{phase.existing.title}</strong> ועניתם על {Object.keys(phase.existing.answers).length} מתוך{' '}
          {phase.existing.questionIds.length} שאלות. מה לעשות?
        </p>
        <div class="row-actions">
          <button class="btn" onClick={() => resume(phase.existing)}>
            להמשיך את המבחן הפתוח
          </button>
          <button class="btn secondary" onClick={() => discardExisting(phase.pending)}>
            לוותר עליו ולהתחיל את החדש
          </button>
        </div>
      </div>
    );
  if (phase.kind === 'results' && data) return <Results summary={phase.summary} data={data} />;
  if (!exam || !data) return null;

  return (
    <Runner
      exam={exam}
      data={data}
      secondsLeft={secondsLeft}
      change={change}
      onFinish={() => {
        const unanswered = exam.questionIds.filter((id) => !isComplete(data.byId[id], exam.answers[id])).length;
        if (unanswered || exam.feedback === 'end') setConfirmFinish(true);
        else finish();
      }}
      confirmFinish={confirmFinish}
      cancelFinish={() => setConfirmFinish(false)}
      doFinish={finish}
    />
  );
}

// =====================================================================

function Runner(props: {
  exam: ActiveExam;
  data: Loaded;
  secondsLeft: number | null;
  change: (fn: (ex: ActiveExam) => void) => void;
  onFinish: () => void;
  confirmFinish: boolean;
  cancelFinish: () => void;
  doFinish: () => void;
}) {
  const { exam, data, secondsLeft, change } = props;
  const total = exam.questionIds.length;
  const id = exam.questionIds[exam.current];
  const q = data.byId[id];
  const answer = exam.answers[id];
  const instant = exam.feedback === 'instant';
  const checked = !!exam.checked[id];
  const complete = isComplete(q, answer);
  const answeredCount = exam.questionIds.filter((x) => isComplete(data.byId[x], exam.answers[x])).length;
  const isLast = exam.current === total - 1;
  const flagged = exam.flagged.includes(id);
  const topRef = useRef<HTMLDivElement>(null);

  const go = (i: number) => {
    change((ex) => (ex.current = Math.max(0, Math.min(total - 1, i))));
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const setAnswer = (a: Answer) => {
    if (instant && checked) return;
    change((ex) => (ex.answers[id] = a));
  };

  const check = () => {
    if (!complete || checked) return;
    change((ex) => (ex.checked[id] = true));
    update((s) => recordAnswer(s, exam.lang, q.chapter, q.topic, id, isCorrect(q, answer)));
  };

  const primary = () => {
    if (instant && !checked) return check();
    if (isLast) return props.onFinish();
    go(exam.current + 1);
  };

  // keyboard: 1-6 pick an option, T/F for true-false, Enter = check / next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (props.confirmFinish || e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const n = Number(e.key);
      if (n >= 1 && n <= 6) {
        if (q.type === 'single' || q.type === 'output' || q.type === 'smell' || q.type === 'cleaner') {
          const order = exam.order[id] ?? q.options.map((_, i) => i);
          if (n <= order.length) setAnswer({ kind: 'choice', index: order[n - 1] });
        } else if (q.type === 'truefalse' && n <= 2) setAnswer({ kind: 'bool', value: n === 1 });
        return;
      }
      if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName !== 'BUTTON') {
        e.preventDefault();
        primary();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const paletteClass = (qid: string, i: number) => {
    const c: string[] = [];
    const qq = data.byId[qid];
    if (instant && exam.checked[qid]) c.push(isCorrect(qq, exam.answers[qid]) ? 'ok' : 'bad');
    else if (isComplete(qq, exam.answers[qid])) c.push('done');
    if (i === exam.current) c.push('cur');
    if (exam.flagged.includes(qid)) c.push('flag');
    return c.join(' ');
  };

  const t = topicTitle(data.index, q.chapter, q.topic);
  const showTopic = exam.mode !== 'topic';
  const unanswered = total - answeredCount;

  return (
    <div class="exam" ref={topRef}>
      <div class="exam-top">
        <h1 class="exam-title">{exam.title}</h1>
        <div class="row-actions">
          <span class="muted">
            נענו {answeredCount} מתוך {total}
          </span>
          {secondsLeft !== null && (
            <span class={`timer${secondsLeft < 300 ? ' low' : ''}`} role="timer" aria-label="זמן שנותר">
              {fmtTime(secondsLeft)}
            </span>
          )}
        </div>
      </div>
      <div class="progressbar" aria-hidden="true">
        <div style={{ width: `${(100 * answeredCount) / total}%` }} />
      </div>

      {!storageAvailable() && (
        <p class="notice warn">הדפדפן חוסם שמירה מקומית, לכן ההתקדמות לא תישמר אחרי סגירת הדף.</p>
      )}

      <QuestionCard
        key={id}
        q={q}
        answer={answer}
        onAnswer={setAnswer}
        order={exam.order[id]}
        mode={instant && checked ? 'feedback' : 'answer'}
        number={exam.current + 1}
        total={total}
        topicLabel={showTopic ? bilingual(t.he, t.en) : undefined}
      />

      <div class="exam-nav">
        <button class="btn secondary" disabled={exam.current === 0} onClick={() => go(exam.current - 1)}>
          → הקודמת
        </button>
        <button
          class={`btn ghost${flagged ? ' on' : ''}`}
          aria-pressed={flagged}
          onClick={() => change((ex) => (ex.flagged = flagged ? ex.flagged.filter((x) => x !== id) : [...ex.flagged, id]))}
        >
          {flagged ? 'הסרת סימון' : 'סימון לחזרה'}
        </button>
        <span class="grow" />
        {instant && !checked ? (
          <button class="btn" disabled={!complete} onClick={check}>
            בדיקה
          </button>
        ) : isLast ? (
          <button class="btn" onClick={props.onFinish}>
            סיום המבחן
          </button>
        ) : (
          <button class="btn" onClick={() => go(exam.current + 1)}>
            הבאה ←
          </button>
        )}
      </div>

      <nav class="palette" aria-label="מעבר בין שאלות">
        {exam.questionIds.map((qid, i) => (
          <button class={paletteClass(qid, i)} aria-label={`שאלה ${i + 1}`} aria-current={i === exam.current ? 'step' : undefined} onClick={() => go(i)}>
            {i + 1}
          </button>
        ))}
      </nav>
      <p class="muted small">
        מקלדת: <kbd>1</kbd>-<kbd>6</kbd> לבחירת תשובה, <kbd>Enter</kbd> {instant ? 'לבדיקה ולמעבר' : 'למעבר'}.{' '}
        {!isLast && (
          <button class="linkish" onClick={props.onFinish}>
            לסיים את המבחן עכשיו
          </button>
        )}
      </p>

      {props.confirmFinish && (
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="finish-title">
          <div class="card">
            <h2 id="finish-title">לסיים את המבחן?</h2>
            {unanswered > 0 ? (
              <p>
                נשארו <strong>{unanswered}</strong> שאלות בלי תשובה. שאלה בלי תשובה נחשבת כטעות.
              </p>
            ) : (
              <p>עניתם על כל השאלות. אחרי הסיום אי אפשר לשנות תשובות.</p>
            )}
            {exam.flagged.length > 0 && <p class="muted">סימנתם {exam.flagged.length} שאלות לחזרה.</p>}
            <div class="row-actions">
              <button class="btn" onClick={props.doFinish}>
                כן, לסיים
              </button>
              <button class="btn secondary" onClick={props.cancelFinish} autoFocus>
                לחזור למבחן
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================

function Results({ summary, data }: { summary: ExamSummary; data: Loaded }) {
  const [filter, setFilter] = useState<'wrong' | 'all'>('wrong');
  const [copied, setCopied] = useState(false);
  const answers = summary.answers ?? [];
  const pass = summary.passed ?? summary.score >= 85;
  const state = load();
  const showBackup = state.exams.length - (state.backupReminderAt ?? 0) >= BACKUP_EVERY;

  const byTopic = useMemo(() => {
    const m = new Map<string, { chapter: string; topic: string; ok: number; n: number }>();
    for (const a of answers) {
      const q = data.byId[a.q];
      if (!q) continue;
      const k = `${q.chapter}/${q.topic}`;
      const e = m.get(k) ?? { chapter: q.chapter, topic: q.topic, ok: 0, n: 0 };
      e.n++;
      if (a.ok) e.ok++;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => a.ok / a.n - b.ok / b.n);
  }, [summary.id]);

  const list = answers.filter((a) => data.byId[a.q] && (filter === 'all' || !a.ok));
  const wrongCount = answers.filter((a) => !a.ok).length;
  const verdict =
    summary.mode === 'simulation' ? (pass ? 'עברתם את הסימולציה!' : 'עוד לא. ציון המעבר הוא ' + (summary.passed === undefined ? 85 : data.index.simulation.passScore)) : summary.score >= 85 ? 'מצוין!' : summary.score >= 60 ? 'בדרך הנכונה' : 'כדאי לתרגל עוד';

  const share = async () => {
    const text = `קיבלתי ${summary.score} ב${summary.title} באתר ${'ידידיה פרידלנד'}`;
    const url = location.origin + href(`/${summary.lang}/`);
    try {
      if (navigator.share) await navigator.share({ title: summary.title, text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setCopied(true);
      }
    } catch {
      /* user cancelled */
    }
  };

  const dismissBackup = () => {
    update((s) => (s.backupReminderAt = s.exams.length));
  };

  return (
    <div class="results">
      <section class="card result-hero">
        <p class="muted">{summary.title}</p>
        <p class={`score ${summary.mode === 'simulation' ? (pass ? 'pass' : 'fail') : summary.score >= 85 ? 'pass' : summary.score < 60 ? 'fail' : ''}`}>{summary.score}</p>
        <p class="verdict-line">
          <strong>{verdict}</strong>
        </p>
        <p class="muted">
          {summary.correct} תשובות נכונות מתוך {summary.total} · {fmtDuration(summary.durationSec)}
        </p>
        <div class="result-actions">
          {wrongCount > 0 && (
            <a class="btn" href={href(`/exam/?lang=${summary.lang}&mode=mistakes`)}>
              לתרגל את הטעויות
            </a>
          )}
          <a class="btn secondary" href={href(`/${summary.lang}/`)}>
            לעמוד השפה
          </a>
          <a class="btn secondary" href={href('/progress/')}>
            ההתקדמות שלי
          </a>
          <button class="btn ghost" onClick={share}>
            {copied ? 'הועתק ללוח' : 'שיתוף התוצאה'}
          </button>
        </div>
      </section>

      {showBackup && (
        <p class="notice">
          כל ההתקדמות נשמרת רק בדפדפן הזה. כדאי לשמור גיבוי מדי פעם:{' '}
          <a href={href('/settings/')} onClick={dismissBackup}>
            ייצוא קובץ גיבוי
          </a>
          .{' '}
          <button class="linkish" onClick={dismissBackup}>
            לא עכשיו
          </button>
        </p>
      )}

      {byTopic.length > 1 && (
        <section class="card">
          <h2>לפי נושא</h2>
          <div class="table-wrap"><table class="data">
            <thead>
              <tr>
                <th>נושא</th>
                <th>נכונות</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {byTopic.map((r) => {
                const t = topicTitle(data.index, r.chapter, r.topic);
                return (
                  <tr>
                    <td>
                      <a href={href(`/${summary.lang}/${r.chapter}/${r.topic}/`)}>{bilingual(t.he, t.en)}</a>
                    </td>
                    <td>
                      {r.ok}/{r.n}
                    </td>
                    <td>
                      <a class="small" href={href(`/exam/?lang=${summary.lang}&mode=topic&chapter=${r.chapter}&topic=${r.topic}`)}>
                        תרגול
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </section>
      )}

      <section>
        <div class="exam-top">
          <h2>סקירת התשובות</h2>
          <div class="seg" role="group" aria-label="סינון">
            <button class={`btn sm secondary${filter === 'wrong' ? ' on' : ''}`} aria-pressed={filter === 'wrong'} onClick={() => setFilter('wrong')}>
              רק טעויות ({wrongCount})
            </button>
            <button class={`btn sm secondary${filter === 'all' ? ' on' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              הכל ({answers.length})
            </button>
          </div>
        </div>
        {!answers.length && <p class="muted">הפירוט של מבחן ישן זה כבר לא נשמר.</p>}
        {answers.length > 0 && !list.length && <p class="muted">אין טעויות. כל הכבוד!</p>}
        <div class="review-list">
          {list.map((a) => {
            const q = data.byId[a.q];
            const t = topicTitle(data.index, q.chapter, q.topic);
            return (
              <QuestionCard
                key={a.q}
                q={q}
                answer={a.a}
                mode="review"
                number={answers.indexOf(a) + 1}
                total={answers.length}
                topicLabel={bilingual(t.he, t.en)}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
