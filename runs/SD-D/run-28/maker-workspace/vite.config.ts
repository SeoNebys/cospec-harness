import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Frontend lives in ./frontend; built assets go to ./frontend/dist,
// which the Fastify backend serves statically in production.
export default defineConfig({
  root: 'frontend',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:4000',
      '/snapshot': 'http://127.0.0.1:4000',
    },
  },
});
