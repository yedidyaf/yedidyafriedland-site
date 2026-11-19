/**
 * Verifies every C# code snippet by compiling them all into ONE console project
 * (each snippet in its own namespace) and running the output snippets via reflection.
 *
 * Snippet forms accepted (what authors write):
 *  1. Top-level statements, optionally followed by type declarations
 *     (exactly like a modern Program.cs).
 *  2. A full program containing `static void Main` (or `static async Task Main`).
 *  3. Type declarations only (for non-output questions).
 * Unhandled exception => the exception type name (e.g. "NullReferenceException")
 * is appended as the last output line.
 * Questions tagged "compile-error" are compiled alone and must FAIL to compile.
 * Questions tagged "pseudo" are skipped.
 *
 * Requires the .NET 8 SDK (`dotnet`). Usage: npm run verify:csharp
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { collectSnippets, normOutput, report, type Snippet } from './lib';

const TYPE_DECL = /^(?:\[[^\]]*\]\s*)*(?:(?:public|internal|private|protected|abstract|sealed|static|partial|file|readonly|unsafe|ref)\s+)*(?:class|struct|interface|record|enum|delegate)\b/;

export function wrapSnippet(code: string, ns: string): string {
  const lines = code.replace(/\r\n?/g, '\n').split('\n');
  const usings: string[] = [];
  let i = 0;
  while (i < lines.length && (/^\s*using\s+[\w.]+\s*;\s*$/.test(lines[i]) || /^\s*using\s+static\s+[\w.]+\s*;/.test(lines[i]) || lines[i].trim() === '')) {
    if (lines[i].trim()) usings.push(lines[i].trim());
    i++;
  }
  const rest = lines.slice(i);
  const body = rest.join('\n');
  if (/\bstatic\s+(?:async\s+)?(?:void|int|Task(?:<int>)?)\s+Main\s*\(/.test(body)) {
    return `namespace ${ns} {\n${usings.join('\n')}\n${body}\n}\n`;
  }
  const firstType = rest.findIndex((l) => TYPE_DECL.test(l));
  const stmts = (firstType === -1 ? rest : rest.slice(0, firstType)).join('\n');
  const types = firstType === -1 ? '' : rest.slice(firstType).join('\n');
  if (!stmts.trim()) return `namespace ${ns} {\n${usings.join('\n')}\n${types}\n}\n`;
  const isAsync = /\bawait\b/.test(stmts);
  return `namespace ${ns} {\n${usings.join('\n')}\nstatic class __Snippet {\npublic static ${isAsync ? 'async System.Threading.Tasks.Task' : 'void'} Main() {\n${stmts}\n}\n}\n${types}\n}\n`;
}

const CSPROJ = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <LangVersion>12</LangVersion>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>disable</Nullable>
    <InvariantGlobalization>true</InvariantGlobalization>
    <StartupObject>__Runner</StartupObject>
    <TreatWarningsAsErrors>false</TreatWarningsAsErrors>
    <NoWarn>$(NoWarn);CS0168;CS0219;CS0162;CS8321;CS0414;CS0169;CS0649;CS1998;CS0108;CS0114;CS4014;CS0067</NoWarn>
  </PropertyGroup>
</Project>`;

const RUNNER = `using System.Reflection;
using System.Text.Json;
public static class __Runner {
  public static void Main(string[] args) {
    var ids = args;
    var results = new Dictionary<string, string>();
    var realOut = Console.Out;
    foreach (var ns in ids) {
      var asm = typeof(__Runner).Assembly;
      var main = asm.GetTypes().Where(t => t.Namespace == ns)
        .SelectMany(t => t.GetMethods(BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic))
        .FirstOrDefault(m => m.Name == "Main");
      if (main == null) { results[ns] = "__NO_MAIN__"; continue; }
      var sw = new StringWriter();
      Console.SetOut(sw);
      try {
        var args0 = main.GetParameters().Length == 1 ? new object[] { new string[0] } : null;
        var task = System.Threading.Tasks.Task.Run(() => {
          try {
            var ret = main.Invoke(null, args0);
            if (ret is System.Threading.Tasks.Task t) t.GetAwaiter().GetResult();
          } catch (TargetInvocationException e) { throw e.InnerException!; }
        });
        if (!task.Wait(TimeSpan.FromSeconds(10))) { results[ns] = "__TIMEOUT__"; continue; }
      } catch (AggregateException ae) {
        var ex = ae.InnerException!;
        sw.Flush();
        sw.WriteLine();
        sw.Write(ex.GetType().Name);
      } finally { Console.SetOut(realOut); }
      results[ns] = sw.ToString();
    }
    File.WriteAllText("results.json", JsonSerializer.Serialize(results));
  }
}`;

function dotnet(args: string[], cwd: string) {
  return spawnSync('dotnet', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' } });
}

function main() {
  const snippets = collectSnippets('csharp');
  const failures: string[] = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csverify-'));
  const proj = path.join(tmp, 'all');
  fs.mkdirSync(proj);
  fs.writeFileSync(path.join(proj, 'Verify.csproj'), CSPROJ);
  fs.writeFileSync(path.join(proj, '__Runner.cs'), RUNNER);
  const main: Snippet[] = snippets.filter((s) => s.mode !== 'compile-error');
  const nsOf = new Map<string, Snippet>();
  main.forEach((s, i) => {
    const ns = `Q_${i}`;
    nsOf.set(ns, s);
    fs.writeFileSync(path.join(proj, `${ns}.cs`), `// ${s.id}\n` + wrapSnippet(s.code, ns));
  });

  // 1) Build everything; map compile errors back to question ids.
  let b = dotnet(['build', '-c', 'Release', '-nologo', '-v', 'q', '-clp:NoSummary'], proj);
  if (b.status !== 0) {
    const errLines = (b.stdout + b.stderr).split('\n').filter((l) => /error CS\d+/.test(l));
    const bad = new Set<string>();
    for (const l of errLines) {
      const m = l.match(/(Q_\d+)\.cs\((\d+),(\d+)\): error (CS\d+): ([^\[]*)/);
      if (m) {
        const s = nsOf.get(m[1]);
        bad.add(m[1]);
        failures.push(`${s?.id}: compile error ${m[4]} (wrapped line ${m[2]}): ${m[5].trim()}`);
      }
    }
    if (!bad.size) {
      console.error(b.stdout + b.stderr);
      process.exit(1);
    }
    // Remove failing snippets and rebuild so the rest can still be checked.
    for (const ns of bad) fs.rmSync(path.join(proj, `${ns}.cs`));
    for (const ns of bad) nsOf.delete(ns);
    b = dotnet(['build', '-c', 'Release', '-nologo', '-v', 'q', '-clp:NoSummary'], proj);
    if (b.status !== 0) {
      console.error(b.stdout + b.stderr);
      process.exit(1);
    }
  }

  // 2) Run output snippets.
  const toRun = [...nsOf.entries()].filter(([, s]) => s.mode === 'run').map(([ns]) => ns);
  if (toRun.length) {
    const dll = path.join(proj, 'bin', 'Release', 'net8.0', 'Verify.dll');
    const r = spawnSync('dotnet', [dll, ...toRun], { cwd: proj, encoding: 'utf8', maxBuffer: 1 << 28 });
    if (r.status !== 0) {
      console.error(r.stdout + r.stderr);
      process.exit(1);
    }
    const results: Record<string, string> = JSON.parse(fs.readFileSync(path.join(proj, 'results.json'), 'utf8'));
    for (const ns of toRun) {
      const s = nsOf.get(ns)!;
      const raw = results[ns];
      if (raw === '__TIMEOUT__' || raw === '__NO_MAIN__') {
        failures.push(`${s.id}: ${raw}`);
        continue;
      }
      const actual = normOutput(raw);
      if (actual !== s.expected)
        failures.push(`${s.id}: marked answer does not match real output.\n  expected (marked): ${JSON.stringify(s.expected)}\n  actual:            ${JSON.stringify(actual)}`);
      else if (s.options!.filter((o) => o === actual).length > 1) failures.push(`${s.id}: more than one option equals the real output`);
    }
  }

  // 3) compile-error snippets must fail to compile, each on its own.
  for (const s of snippets.filter((x) => x.mode === 'compile-error')) {
    const dir = path.join(tmp, 'ce_' + s.id.replace(/\W/g, '_'));
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'Verify.csproj'), CSPROJ.replace('<StartupObject>__Runner</StartupObject>', ''));
    fs.writeFileSync(path.join(dir, 'Snippet.cs'), s.code);
    const c = dotnet(['build', '-nologo', '-v', 'q'], dir);
    if (c.status === 0) failures.push(`${s.id}: tagged compile-error but it compiles`);
  }

  report('C#', failures, snippets.length);
}

if (process.argv[1]?.endsWith('verify-csharp.ts')) main();
