import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The SPA lives in src/web. In dev, Vite serves it and proxies /api to the
// local backend (see src/server/index.ts). In prod, `vite build` emits to dist/
// and the backend serves those static files.
export default defineConfig({
  root: 'src/web',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
});
