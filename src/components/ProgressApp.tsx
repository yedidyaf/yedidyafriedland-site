/** "My progress" page: everything is read from this browser only. */
import { useEffect, useState } from 'preact/hooks';
import { fetchIndex } from '../lib/client-data';
import { level, mastery, readiness, LEVEL_LABEL } from '../lib/scoring';
import { load, subscribe, type State } from '../lib/storage';
import { bilingual } from '../lib/text';
import { href } from '../lib/url';
import type { LanguageIndex } from '../lib/types';

const MODE_LABEL = { topic: 'נושא', chapter: 'פרק', mixed: 'מעורב', simulation: 'סימולציה', mistakes: 'טעויות' } as const;

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function ProgressApp({ langs }: { langs: string[] }) {
  const [state, setState] = useState<State | null>(null);
  const [indexes, setIndexes] = useState<LanguageIndex[]>([]);
  useEffect(() => {
    setState(load());
    Promise.all(langs.map(fetchIndex)).then(setIndexes).catch(console.error);
    return subscribe(setState);
  }, []);
  if (!state) return <p class="muted">טוען...</p>;

  const answered = Object.keys(state.questions).length;
  if (!answered && !state.exams.length)
    return (
      <div class="card center-pad">
        <p>עוד לא עניתם על שאלות בדפדפן הזה. כאן תראו את ההתקדמות שלכם לפי נושא, את המוכנות למבחן ואת היסטוריית המבחנים.</p>
        <a class="btn" href={href('/')}>
          להתחיל לתרגל
        </a>
        <p class="muted small" style="margin-top:12px">
          יש לכם גיבוי ממחשב אחר? <a href={href('/settings/')}>ייבוא קובץ גיבוי</a>
        </p>
      </div>
    );

  const exams = [...state.exams].reverse();
  const ex = state.activeExam;
  return (
    <div class="stack">
      {ex && (
        <p class="notice">
          יש לכם מבחן פתוח: {ex.title}.{' '}
          <a class="btn sm" href={href('/exam/')}>
            להמשיך
          </a>
        </p>
      )}
      <div class="grid cols-3">
        <div class="card stat">
          <span class="v">{answered}</span>
          <span class="l">שאלות שונות שעניתם עליהן</span>
        </div>
        <div class="card stat">
          <span class="v">{state.exams.length}</span>
          <span class="l">מבחנים שהסתיימו</span>
        </div>
        <div class="card stat">
          <span class="v">{state.exams.filter((e) => e.mode === 'simulation' && e.passed).length}</span>
          <span class="l">סימולציות שעברתם</span>
        </div>
      </div>

      {indexes.map((ix) => {
        const touched = ix.chapters.some((c) => c.topics.some((t) => state.topics[`${ix.id}/${c.id}/${t.id}`]?.length));
        if (!touched) return null;
        const rd = readiness(ix.chapters, ix.simulation.blueprint, state.topics, (c, t) => `${ix.id}/${c}/${t}`);
        return (
          <section class="card">
            <div class="exam-top" style="margin-top:0">
              <h2 style="margin:0">{bilingual(ix.title_he, ix.title_en)}</h2>
              <span>
                מוכנות למבחן: <strong>{rd}%</strong>
              </span>
            </div>
            <div class="progressbar">
              <div style={{ width: `${rd}%` }} />
            </div>
            <div class="table-wrap" style="margin-top:12px">
              <table class="data">
                <thead>
                  <tr>
                    <th>נושא</th>
                    <th>מצב</th>
                    <th>תשובות</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ix.chapters.flatMap((c) =>
                    c.topics.map((t) => {
                      const r = state.topics[`${ix.id}/${c.id}/${t.id}`];
                      if (!r?.length) return null;
                      const lv = level(r);
                      const m = mastery(r);
                      return (
                        <tr>
                          <td>
                            <a href={href(`/${ix.id}/${c.id}/${t.id}/`)}>{bilingual(t.title_he, t.title_en)}</a>
                            <div class="muted small">{c.title_he}</div>
                          </td>
                          <td>
                            <span class={`lvl ${lv}`}>
                              {LEVEL_LABEL[lv]}
                              {m !== null ? ` ${m}%` : ''}
                            </span>
                          </td>
                          <td>{r.length}</td>
                          <td>
                            <a class="small" href={href(`/exam/?lang=${ix.id}&mode=topic&chapter=${c.id}&topic=${t.id}`)}>
                              לתרגל
                            </a>
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {exams.length > 0 && (
        <section class="card">
          <h2>היסטוריית מבחנים</h2>
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>מתי</th>
                  <th>מבחן</th>
                  <th>סוג</th>
                  <th>ציון</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {exams.map((e) => (
                  <tr>
                    <td class="small">{fmtDate(e.finishedAt)}</td>
                    <td>{e.title}</td>
                    <td class="small">{MODE_LABEL[e.mode]}</td>
                    <td>
                      <strong class={e.passed === false ? 'text-danger' : e.passed ? 'text-success' : ''}>{e.score}</strong>
                      <span class="muted small">
                        {' '}
                        ({e.correct}/{e.total})
                      </span>
                    </td>
                    <td>
                      {e.answers ? (
                        <a class="small" href={href(`/exam/?result=${e.id}`)}>
                          פירוט
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p class="muted small">
        כל הנתונים האלה שמורים רק בדפדפן הזה. כדי לא לאבד אותם, <a href={href('/settings/')}>שמרו קובץ גיבוי</a>.
      </p>
    </div>
  );
}
