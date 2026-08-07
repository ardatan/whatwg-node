/**
 * Allocation-focused fetch microbench (local server).
 * Usage: node --expose-gc scripts/bench-fetch-alloc.mjs
 */
import { createServer } from 'node:http';
import { fetchPonyfill } from '../packages/node-fetch/dist/esm/fetch.js';

const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ hello: 'world' }));
});
await new Promise(r => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;
const N = 3000;

async function measure(label, fn) {
  for (let i = 0; i < 300; i++) await fn();
  if (globalThis.gc) globalThis.gc();
  const before = process.memoryUsage();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) await fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (globalThis.gc) globalThis.gc();
  const after = process.memoryUsage();
  const heapDelta = (after.heapUsed - before.heapUsed) / N;
  const ops = (N / ms) * 1000;
  console.log(
    `${label.padEnd(28)} ${ops.toFixed(0).padStart(7)} ops/s | heapΔ/req ${heapDelta.toFixed(1).padStart(8)} B`,
  );
}

console.log(`Node ${process.version} | N=${N}\n`);

await measure('noConsume', async () => {
  await fetchPonyfill(url, { agent: false });
});
await measure('consume json', async () => {
  const res = await fetchPonyfill(url, { agent: false });
  await res.json();
});
await measure('consume text + body touch', async () => {
  const res = await fetchPonyfill(url, { agent: false });
  void res.body;
  await res.text();
});

server.close();
