// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// SITE_URL / BASE_PATH let the same build run on the custom domain (default)
// or on a GitHub Pages project URL (BASE_PATH=/yedidyafriedland-site).
const site = process.env.SITE_URL || 'https://yedidyafriedland.com';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [preact(), sitemap({ filter: (page) => !['/exam/', '/data/', '/progress/', '/settings/'].some((p) => page.includes(p)) })],
  build: { format: 'directory' },
  vite: { build: { chunkSizeWarningLimit: 800 } },
});
