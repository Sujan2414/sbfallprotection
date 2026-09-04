import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.sbfallprotection.com',
  // Fully static output — every product page is pre-rendered HTML so Google
  // indexes each SKU. Deploys as plain files to Netlify.
  output: 'static',
  build: { format: 'directory' },
  integrations: [sitemap({ filter: (page) => !page.includes('/admin') })],
  devToolbar: { enabled: false },
});
