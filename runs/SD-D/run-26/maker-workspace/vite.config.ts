import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  resolve: {
    alias: { '@shared': path.resolve('shared/src'), '@client': path.resolve('client/src') }
  },
  build: { outDir: '../dist/client', emptyOutDir: true },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:4000', '/health': 'http://127.0.0.1:4000' }
  }
});
