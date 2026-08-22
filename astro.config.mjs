import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Replace with your real domain once you have one — needed for correct
  // canonical URLs and sitemap generation.
  site: 'https://oneirahome.com',
  integrations: [sitemap()],
});
