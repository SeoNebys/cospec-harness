import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser UI lives in src/web and builds to dist/web, which the local
// server serves as static assets. See specs/001-bookmark-manager/plan.md.
export default defineConfig({
  root: 'src/web',
  plugins: [react()],
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
});
