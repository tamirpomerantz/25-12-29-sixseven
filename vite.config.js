import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  // Support SPA routing - all routes should fallback to index.html
  // This is handled by Firebase hosting rewrites in production
  // For dev server, Vite automatically handles this
});

