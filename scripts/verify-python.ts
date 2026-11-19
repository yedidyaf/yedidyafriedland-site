/**
 * Verifies every Python code snippet:
 *  - output questions: runs the code and checks the marked answer equals the real output,
 *    and that no other option equals it too;
 *  - all other code: must parse (unless tagged "pseudo" or "compile-error").
 * Usage: npm run verify:python [-- --python python3.12]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { collectSnippets, normOutput, report } from './lib';

const pyArg = process.argv.indexOf('--python');
const python = pyArg > -1 ? process.argv[pyArg + 1] : process.env.PYTHON ?? 'python3';

const snippets = collectSnippets('python');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pyverify-'));
const tasksFile = path.join(tmp, 'tasks.json');
fs.writeFileSync(tasksFile, JSON.stringify(snippets));
const harness = path.resolve('scripts/run_python_snippets.py');
const r = spawnSync(python, ['-I', harness, tasksFile], { encoding: 'utf8', maxBuffer: 1 << 28 });
if (r.status !== 0) {
  console.error(r.stderr);
  process.exit(1);
}
const results: Record<string, { ok: boolean; stdout?: string; stderr?: string; error?: string }> = JSON.parse(r.stdout);
const failures: string[] = [];
for (const s of snippets) {
  const res = results[s.id];
  if (!res?.ok) {
    failures.push(`${s.id}: ${res?.error ?? 'no result'}`);
    continue;
  }
  if (s.mode !== 'run') continue;
  const actual = normOutput(res.stdout ?? '');
  if (actual !== s.expected) {
    failures.push(`${s.id}: marked answer does not match real output.\n  expected (marked): ${JSON.stringify(s.expected)}\n  actual:            ${JSON.stringify(actual)}${res.stderr ? `\n  stderr: ${res.stderr.trim()}` : ''}`);
  } else if (s.options!.filter((o) => o === actual).length > 1) {
    failures.push(`${s.id}: more than one option equals the real output`);
  }
}
report('Python', failures, snippets.length);
