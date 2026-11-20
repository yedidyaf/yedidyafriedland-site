# Project rules

Hebrew site that teaches Python and C# only through tests. Site name "ידידיה פרידלנד - Yedidya Friedland";
the goal is to make the owner known as a programming teacher, so quality and SEO matter.

## Non-negotiable
- No server-side user data, no accounts, no cookies. All progress lives in localStorage under
  `yf.progress.v1` (`src/lib/storage.ts`). Change the schema only with a migration in `migrate()`.
- Every chapter, topic and page title is bilingual: "עברית - English".
- UI text is Hebrew, plural gender-neutral imperative ("בחרו", "שבצו"). RTL layout, code is LTR.
- Questions follow `docs/CONTENT_GUIDE.md` exactly. Never renumber or reuse a question id.
- Simulation exam: 30 questions, 40 minutes, pass score 85 (in `content/<lang>/language.yaml`).

## Before committing
- `npm run validate -- --strict`, `npm run verify:python`, `npm run check`, `npm test`, `npm run build`.
- `npm run e2e` (locally you may need `PW_CHROMIUM_PATH=<path to chromium>`).
- C# snippets are verified in CI (`npm run verify:csharp` needs the .NET 8 SDK).

## Layout
- `content/` YAML questions; `src/lib/` pure logic (schema, content loader, scoring, exam, storage);
  `src/components/` Preact islands (ExamApp, QuestionCard, ProgressApp, SettingsApp);
  `src/pages/` Astro pages, `/data/<lang>/*.json` is generated at build time.
