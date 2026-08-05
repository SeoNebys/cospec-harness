// Tiny zero-dependency test harness.
const tests = [];
export function test(name, fn) { tests.push({ name, fn }); }

export async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      console.log("  ✓ " + t.name);
    } catch (e) {
      fail++;
      console.log("  ✗ " + t.name);
      console.log("    " + (e && e.message ? e.message : e));
    }
  }
  console.log(`\n${pass} passed, ${fail} failed, ${tests.length} total`);
  if (fail > 0) process.exit(1);
}
