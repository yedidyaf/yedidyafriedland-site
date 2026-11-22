# ידידיה פרידלנד - Yedidya Friedland

אתר ללימוד Python ו-C# דרך מבחנים, בסגנון תרגול למבחן התאוריה. כל שאלה מגיעה עם הסבר,
וכל קטע קוד נבדק אוטומטית בהרצה או בקומפילציה. ההתקדמות נשמרת רק בדפדפן (localStorage);
אין שרת, אין הרשמה ואין איסוף מידע.

A static site (Astro + Preact islands) for learning Python and C# through tests.

## Run locally

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # validates content, then builds to dist/
npm run preview
```

## Content

Questions live in `content/<lang>/<chapter>/<topic>.yaml`. Read
[`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md) before writing or editing questions.

```bash
npm run validate -- --strict   # schema + semantic checks (CONTENT_ONLY=python/strings to narrow)
npm run verify:python          # runs every Python snippet (Python 3.12)
npm run verify:csharp          # compiles/runs every C# snippet (needs the .NET 8 SDK)
npm run stats                  # questions per topic and type
```

## Tests

```bash
npm test                       # unit tests (scoring, storage, exam, content)
npm run e2e                    # Playwright end-to-end tests against the built site
```

CI (`.github/workflows/ci.yml`) runs all of the above on every push and pull request.

## Deploy

- **Preview:** every push to `main` deploys to GitHub Pages (`.github/workflows/pages.yml`),
  marked `noindex` so it does not compete with the real domain.
- **Production (planned):** Cloudflare Pages connected to this repository.
  Build command `npm run build`, output directory `dist`,
  environment variables `SITE_URL=https://yedidyafriedland.com` and, for visitor counts,
  `PUBLIC_CF_BEACON_TOKEN=<token from Cloudflare Web Analytics>` (cookieless).
- **Email:** `hello@yedidyafriedland.com` via Cloudflare Email Routing (forwarding only).

## Environment variables

| name | default | purpose |
| --- | --- | --- |
| `SITE_URL` | `https://yedidyafriedland.com` (on Vercel: the deployment's own domain) | canonical URLs, sitemap, og:image |
| `BASE_PATH` | `/` | sub-path hosting (GitHub Pages preview) |
| `PUBLIC_CF_BEACON_TOKEN` | empty | Cloudflare Web Analytics; no script when empty |
| `PUBLIC_NOINDEX` | empty | `1` adds `noindex` to every page |
| `PUBLIC_GOOGLE_SITE_VERIFICATION` | empty | Search Console HTML-tag token (only if not verifying by DNS) |

## Search and link previews

- Every page has a canonical URL, `hreflang="he"`, Open Graph and Twitter tags with the
  1200x630 `public/og.png` (WhatsApp, Facebook, LinkedIn, Telegram previews).
- Every page carries one JSON-LD graph (`src/lib/seo.ts`): a `Person` (Hebrew and English name,
  LinkedIn in `sameAs`) and a `WebSite` that points to him by `@id`. `/about/` is his `ProfilePage`.
- `sitemap-index.xml` and `robots.txt` are generated; exam, progress and settings pages are `noindex`.
- On Vercel, previews are `noindex` and production uses the project's production domain, so
  WhatsApp previews work before the custom domain is added.
- If `og.png` changes, keep it 1200x630 and under 300 KB (WhatsApp ignores bigger images).

