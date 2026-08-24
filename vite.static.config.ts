import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone config for the GitHub Pages static build (`npm run build:static`).
// No dev-only apiPlugin here — there is no server on GitHub Pages, so
// /api/* routes don't exist; App.tsx falls back to a build-time
// content-index.json when VITE_READ_ONLY is set (see .env.github-pages-static).
export default defineConfig({
  plugins: [react()],
  base: '/hockey-cards/',
  build: {
    outDir: 'github-pages-static',
    emptyOutDir: true,
  },
});
