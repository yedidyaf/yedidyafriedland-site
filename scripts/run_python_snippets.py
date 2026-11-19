"""Run or syntax-check Python snippets. Reads a JSON task list, prints JSON results.

For mode "run": executes the snippet in a fresh interpreter with a timeout.
Output = stdout; if the program raised, the exception class name is appended
as the final line (authors write e.g. "TypeError" as the expected output).
"""
import ast
import json
import subprocess
import sys

tasks = json.load(open(sys.argv[1], encoding="utf-8"))
results = {}
for t in tasks:
    code = t["code"]
    if t["mode"] == "syntax":
        try:
            ast.parse(code)
            results[t["id"]] = {"ok": True}
        except SyntaxError as e:
            results[t["id"]] = {"ok": False, "error": f"SyntaxError line {e.lineno}: {e.msg}"}
        continue
    if t["mode"] == "compile-error":
        try:
            compile(code, "<snippet>", "exec")
            results[t["id"]] = {"ok": False, "error": "tagged compile-error but code compiles"}
        except SyntaxError:
            results[t["id"]] = {"ok": True}
        continue
    wrapper = (
        "import sys\n"
        "src = sys.stdin.read()\n"
        "try:\n"
        "    exec(compile(src, '<snippet>', 'exec'), {'__name__': '__main__'})\n"
        "except SystemExit:\n"
        "    pass\n"
        "except BaseException as e:\n"
        "    sys.stdout.flush()\n"
        "    print(type(e).__name__)\n"
    )
    try:
        p = subprocess.run(
            [sys.executable, "-I", "-c", wrapper],
            input=code, capture_output=True, text=True, timeout=10,
            env={"PYTHONHASHSEED": "0", "PYTHONIOENCODING": "utf-8"},
        )
        results[t["id"]] = {"ok": True, "stdout": p.stdout, "stderr": p.stderr[-500:]}
    except subprocess.TimeoutExpired:
        results[t["id"]] = {"ok": False, "error": "timeout (10s)"}
json.dump(results, sys.stdout, ensure_ascii=False)
