// Phase-3 verification runner: internal logic tests + Gherkin acceptance tests.
import { runTests } from './logic.test.js';
import { runAcceptance, READ_VERIFIED } from './acceptance.test.js';

const logic = runTests();
console.log('\n=== Internal logic tests ===');
for (const x of logic.results) if (!x.pass) console.log('  ✗', x.name);
console.log(`  ${logic.passed}/${logic.total} passed` + (logic.failed ? ` — ${logic.failed} FAILED` : ' ✓'));

const acc = await runAcceptance();
console.log('\n=== Gherkin acceptance tests (by scenario) ===');
const byScn = {};
for (const r of acc.results) (byScn[r.scn] ||= []).push(r);
for (const scn of Object.keys(byScn).sort()) {
  const rows = byScn[scn];
  const bad = rows.filter(r => !r.pass);
  console.log(`  ${bad.length ? '✗' : '✓'} ${scn} — ${rows.length - bad.length}/${rows.length}`);
  for (const r of bad) console.log('      ✗', r.name);
}
console.log(`\n  ${acc.passed}/${acc.total} acceptance checks passed` + (acc.failed ? ` — ${acc.failed} FAILED` : ' ✓'));

console.log('\n=== Read-verified (need a click-through in browser) ===');
for (const s of READ_VERIFIED) console.log('  •', s);

const failed = logic.failed + acc.failed;
console.log(`\n${failed ? 'VERIFICATION FAILED: ' + failed + ' check(s) failed' : 'VERIFICATION PASSED — all logic + acceptance checks green'}`);
process.exit(failed ? 1 : 0);
