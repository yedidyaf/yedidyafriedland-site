/** Settings: theme, backup export/import, delete all local data. */
import { useEffect, useState } from 'preact/hooks';
import { applyTheme } from './ThemeToggle';
import { clearAll, load, makeExport, mergeStates, parseImport, replaceAll, storageAvailable, subscribe, update, ImportError, type State } from '../lib/storage';

type Theme = State['settings']['theme'];

export default function SettingsApp() {
  const [state, setState] = useState<State | null>(null);
  const [pending, setPending] = useState<State | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setState(load());
    return subscribe(setState);
  }, []);
  if (!state) return <p class="muted">טוען...</p>;

  const setTheme = (t: Theme) => {
    applyTheme(t);
    update((s) => (s.settings.theme = t));
  };

  const doExport = () => {
    const file = makeExport(load());
    const blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `yedidyafriedland-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    update((s) => (s.backupReminderAt = s.exams.length));
    setMsg({ kind: 'ok', text: 'קובץ הגיבוי ירד למחשב. שמרו אותו במקום בטוח.' });
  };

  const onFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      setPending(parseImport(await f.text()));
      setMsg(null);
    } catch (err) {
      setPending(null);
      setMsg({ kind: 'err', text: err instanceof ImportError ? err.message : 'קריאת הקובץ נכשלה.' });
    }
  };

  const applyImport = (how: 'merge' | 'replace') => {
    if (!pending) return;
    const cur = load();
    const next = how === 'merge' ? mergeStates(cur, pending) : { ...pending, settings: cur.settings, activeExam: null };
    replaceAll(next);
    setPending(null);
    setMsg({ kind: 'ok', text: how === 'merge' ? 'הגיבוי מוזג עם הנתונים הקיימים.' : 'הנתונים הוחלפו בנתוני הגיבוי.' });
  };

  const answered = Object.keys(state.questions).length;
  return (
    <div class="stack">
      {!storageAvailable() && <p class="notice warn">הדפדפן חוסם שמירה מקומית (למשל בגלישה בסתר). הנתונים יימחקו כשתסגרו את הדף.</p>}
      {msg && (
        <p class={`notice${msg.kind === 'err' ? ' err' : ''}`} role="status">
          {msg.text}
        </p>
      )}

      <section class="card">
        <h2>ערכת נושא - Theme</h2>
        <div class="radios" role="radiogroup">
          {(
            [
              ['auto', 'לפי המערכת'],
              ['light', 'בהירה'],
              ['dark', 'כהה'],
            ] as [Theme, string][]
          ).map(([v, l]) => (
            <label>
              <input type="radio" name="theme" checked={state.settings.theme === v} onChange={() => setTheme(v)} /> {l}
            </label>
          ))}
        </div>
      </section>

      <section class="card">
        <h2>גיבוי ושחזור - Backup</h2>
        <p>
          ההתקדמות נשמרת רק בדפדפן הזה ({answered} שאלות, {state.exams.length} מבחנים). כדי להעביר אותה למחשב אחר או לשמור עליה, ייצאו קובץ גיבוי וייבאו אותו
          במקום אחר.
        </p>
        <div class="row-actions">
          <button class="btn" onClick={doExport}>
            ייצוא קובץ גיבוי
          </button>
          <label class="btn secondary">
            ייבוא מקובץ
            <input type="file" accept="application/json,.json" onChange={onFile} class="sr-only" />
          </label>
        </div>
        {pending && (
          <div class="notice" style="margin-top:14px">
            <p>
              בקובץ יש {Object.keys(pending.questions).length} שאלות ו-{pending.exams.length} מבחנים. מה לעשות איתו?
            </p>
            <div class="row-actions">
              <button class="btn sm" onClick={() => applyImport('merge')}>
                למזג עם מה שיש כאן
              </button>
              <button class="btn sm secondary" onClick={() => applyImport('replace')}>
                להחליף את מה שיש כאן
              </button>
              <button class="btn sm ghost" onClick={() => setPending(null)}>
                ביטול
              </button>
            </div>
          </div>
        )}
      </section>

      <section class="card">
        <h2>מחיקת הנתונים</h2>
        <p>מחיקה של כל ההתקדמות, הציונים וההגדרות מהדפדפן הזה. אי אפשר לבטל את זה, אלא אם שמרתם גיבוי.</p>
        {!confirmDelete ? (
          <button class="btn danger" onClick={() => setConfirmDelete(true)}>
            מחיקת כל הנתונים
          </button>
        ) : (
          <div class="row-actions">
            <strong>בטוח?</strong>
            <button
              class="btn danger"
              onClick={() => {
                clearAll();
                applyTheme('auto');
                setConfirmDelete(false);
                setMsg({ kind: 'ok', text: 'כל הנתונים נמחקו מהדפדפן הזה.' });
              }}
            >
              כן, למחוק הכל
            </button>
            <button class="btn secondary" onClick={() => setConfirmDelete(false)}>
              ביטול
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
