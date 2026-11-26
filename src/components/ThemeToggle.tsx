import { useEffect, useState } from 'preact/hooks';
import { load, update } from '../lib/storage';

type Theme = 'auto' | 'light' | 'dark';
const NEXT: Record<Theme, Theme> = { auto: 'dark', dark: 'light', light: 'auto' };
const LABEL: Record<Theme, string> = { auto: 'ערכת נושא: לפי המערכת', dark: 'ערכת נושא: כהה', light: 'ערכת נושא: בהירה' };
const ICON: Record<Theme, preact.JSX.Element> = {
  auto: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" /></svg>
  ),
  dark: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
  ),
  light: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
  ),
};

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
      <style>{`.theme-btn{font:inherit;background:transparent;border:1.5px solid var(--text);color:var(--text);border-radius:50%;width:36px;height:36px;padding:0;cursor:pointer;display:inline-grid;place-items:center}@media (hover:hover){.theme-btn:hover{border-color:var(--pen);color:var(--pen)}}`}</style>
    </button>
  );
}
