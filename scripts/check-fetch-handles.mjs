/**
 * Smoke-check that fetch ponyfill doesn't leak active handles when body is not consumed
 * (same concern as benchmarks/node-fetch k6 threshold active_handles max<250).
 */
import { createServer } from 'node:http';
import { fetchPonyfill } from '../packages/node-fetch/dist/esm/fetch.js';

const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: true, path: req.url }));
});

await new Promise(resolve => server.listen(0, resolve));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/anything`;

const samples = [];
const N = 500;

for (let i = 0; i < N; i++) {
  // noConsumeBody scenario
  await fetchPonyfill(url, {
    method: 'POST',
    body: '{ "hello": "world" }',
  });
  if (i % 50 === 49) {
    samples.push(process._getActiveHandles().length);
  }
}

// consumeBody scenario
for (let i = 0; i < N; i++) {
  const res = await fetchPonyfill(url, {
    method: 'POST',
    body: '{ "hello": "world" }',
  });
  await res.json();
  if (i % 50 === 49) {
    samples.push(process._getActiveHandles().length);
  }
}

const max = Math.max(...samples);
console.log('active_handles samples:', samples.join(', '));
console.log('active_handles max:', max);
console.log(max < 250 ? 'PASS (max<250)' : 'FAIL (max>=250)');

server.close();
process.exit(max < 250 ? 0 : 1);
