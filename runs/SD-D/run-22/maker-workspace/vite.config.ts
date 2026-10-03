import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@client': '/src/client', '@shared': '/src/shared' } },
  build: { outDir: 'dist/client', emptyOutDir: true },
  server: { host: '0.0.0.0', port: 5173, proxy: { '/api': 'http://127.0.0.1:4000' } },
});
