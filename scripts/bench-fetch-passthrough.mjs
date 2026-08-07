/**
 * Microbench: uncompressed fetch round-trip (local server).
 * Usage: node --expose-gc scripts/bench-fetch-passthrough.mjs
 */
import { createServer } from 'node:http';
import { fetchPonyfill } from '../packages/node-fetch/dist/esm/fetch.js';

const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ hello: 'world' }));
});
await new Promise(resolve => server.listen(0, resolve));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/`;

const ITER = Number(process.env.PERF_ITERS || 5_000);

async function bench(name, fn) {
  for (let i = 0; i < 200; i++) await fn();
  if (globalThis.gc) globalThis.gc();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < ITER; i++) await fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const ops = (ITER / ms) * 1000;
  console.log(`${name.padEnd(40)} ${ops.toFixed(0).padStart(8)} ops/s   ${ms.toFixed(1)} ms`);
}

console.log(`Node ${process.version} | iters=${ITER}\n`);

let n = 0;
await bench('fetch noConsumeBody (agent:false)', async () => {
  await fetchPonyfill(url, { agent: false });
  // Nudge FinalizationRegistry periodically (not every op)
  if (globalThis.gc && ++n % 50 === 0) globalThis.gc();
});

await bench('fetch consumeBody json (agent:false)', async () => {
  const res = await fetchPonyfill(url, { agent: false });
  await res.json();
});

server.close();
