// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// SITE_URL / BASE_PATH let the same build run on the custom domain (default)
// or on a GitHub Pages project URL (BASE_PATH=/yedidyafriedland-site).
// On Vercel, without SITE_URL, use the deployment's own address so canonical and og:image
// links work before the custom domain exists (production uses the project's main domain,
// which becomes the custom domain once it is added in Vercel). Vercel previews are noindex.
const env = process.env;
const vercelHost =
  env.VERCEL_ENV === 'production' ? env.VERCEL_PROJECT_PRODUCTION_URL : env.VERCEL_BRANCH_URL || env.VERCEL_URL;
if (env.VERCEL_ENV === 'preview' && !env.PUBLIC_NOINDEX) env.PUBLIC_NOINDEX = '1';
const site = env.SITE_URL || (vercelHost ? `https://${vercelHost}` : 'https://yedidyafriedland.com');
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [preact(), sitemap({ filter: (page) => !['/exam/', '/data/', '/progress/', '/settings/'].some((p) => page.includes(p)) })],
  build: { format: 'directory' },
  vite: { build: { chunkSizeWarningLimit: 800 } },
});
