// Headless runner for the core-logic tests (CI-friendly). Browser runner: run.html
import { runTests } from './logic.test.js';
const r = runTests();
for (const x of r.results) if (!x.pass) console.log('  ✗', x.name, '| got', JSON.stringify(x.got), 'want', JSON.stringify(x.want));
console.log(`\n${r.passed}/${r.total} checks passed` + (r.failed ? `, ${r.failed} FAILED` : ' ✓'));
process.exit(r.failed ? 1 : 0);
