/** Prefix an absolute site path with the configured base (works on GitHub Pages subpaths). */
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
export function href(path: string): string {
  if (!path.startsWith('/')) path = '/' + path;
  return BASE + path;
}
