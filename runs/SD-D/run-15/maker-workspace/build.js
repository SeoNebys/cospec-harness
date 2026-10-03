// T003: esbuild bundle of the vanilla-JS client into public/.
// Bundles src/client/main.js -> public/app.js and copies index.html + styles.css.
import esbuild from 'esbuild';
import { mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const clientDir = join(root, 'src', 'client');
const outDir = join(root, 'public');

mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [join(clientDir, 'main.js')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: join(outDir, 'app.js'),
  sourcemap: true,
  logLevel: 'info',
});

copyFileSync(join(clientDir, 'index.html'), join(outDir, 'index.html'));
copyFileSync(join(clientDir, 'styles.css'), join(outDir, 'styles.css'));

console.log('Client build complete -> public/');
