// Seed ~500 bookmarks for manual performance / scale checks (SC-006/008).
// Usage: BASE=http://localhost:4000 node tests/fixtures/seed-500.mjs
const base = process.env.BASE || 'http://localhost:4000';

async function post(path, data) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

const langs = ['rust', 'go', 'python', 'javascript', 'elixir'];
const start = Date.now();
for (let i = 0; i < 500; i++) {
  await post('/api/bookmarks', {
    url: `https://seed${i}.example/p`,
    title: `Seed ${i} ${langs[i % langs.length]}`,
    description: `Sample seeded bookmark number ${i}.`,
    tags: ['seed', i % 2 === 0 ? 'even' : 'odd', langs[i % langs.length]],
  });
}
console.log(`Seeded 500 bookmarks in ${((Date.now() - start) / 1000).toFixed(1)}s`);
