import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Builds the React frontend (web/) to web/dist, which Express serves.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    // Dev-only proxy so `vite` dev server can reach the API during development.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
