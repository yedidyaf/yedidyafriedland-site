import { useEffect, useState } from 'preact/hooks';
import { load, update } from '../lib/storage';

type Theme = 'auto' | 'light' | 'dark';
const NEXT: Record<Theme, Theme> = { auto: 'dark', dark: 'light', light: 'auto' };
const LABEL: Record<Theme, string> = { auto: 'ערכת נושא: לפי המערכת', dark: 'ערכת נושא: כהה', light: 'ערכת נושא: בהירה' };
const ICON: Record<Theme, string> = { auto: '◐', dark: '☾', light: '☀' };

export function applyTheme(t: Theme) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('auto');
  useEffect(() => setTheme(load().settings.theme), []);
  const click = () => {
    const t = NEXT[theme];
    setTheme(t);
    applyTheme(t);
    update((s) => (s.settings.theme = t));
  };
  return (
    <button type="button" class="theme-btn" onClick={click} aria-label={LABEL[theme]} title={LABEL[theme]}>
      <span aria-hidden="true">{ICON[theme]}</span>
      <style>{`.theme-btn{font:inherit;background:transparent;border:1px solid var(--border);color:var(--text);border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:1.05rem}.theme-btn:hover{border-color:var(--primary);color:var(--primary)}`}</style>
    </button>
  );
}
