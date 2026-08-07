/**
 * In-process hot-path microbench (no network).
 * Usage: node --expose-gc scripts/perf-hotpath.mjs
 */
import { Readable } from 'node:stream';
import { PonyfillHeaders } from '../packages/node-fetch/dist/esm/Headers.js';
import { PonyfillResponse } from '../packages/node-fetch/dist/esm/Response.js';
import { createServerAdapter, Response } from '../packages/server/dist/esm/index.js';

const ITER = Number(process.env.PERF_ITERS || 200_000);
const WARMUP = Math.min(20_000, Math.floor(ITER / 5));

function now() {
  return process.hrtime.bigint();
}

function measure(name, fn, iters = ITER) {
  for (let i = 0; i < WARMUP; i++) fn();
  if (global.gc) global.gc();
  const memBefore = process.memoryUsage().heapUsed;
  const t0 = now();
  for (let i = 0; i < iters; i++) fn();
  const t1 = now();
  if (global.gc) global.gc();
  const memAfter = process.memoryUsage().heapUsed;
  const ms = Number(t1 - t0) / 1e6;
  const ops = (iters / ms) * 1000;
  const heapDeltaMB = (memAfter - memBefore) / (1024 * 1024);
  console.log(
    `${name.padEnd(42)} ${ops.toFixed(0).padStart(10)} ops/s   ${ms.toFixed(1).padStart(8)} ms   heapΔ ${heapDeltaMB.toFixed(2).padStart(7)} MB`,
  );
  return { name, ops, ms, heapDeltaMB };
}

function makeNodeReqRes() {
  const req = {
    method: 'GET',
    url: '/hello',
    headers: {
      host: 'localhost',
      'content-type': 'application/json',
      'user-agent': 'bench',
      accept: '*/*',
      'x-request-id': 'abc',
    },
    socket: { encrypted: false },
    // isNodeRequest() checks for `.read`
    read() {
      return null;
    },
    on() {
      return this;
    },
    once() {
      return this;
    },
    pipe() {
      return this;
    },
  };
  const listeners = new Map();
  const res = {
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    closed: false,
    destroyed: false,
    once(event, cb) {
      listeners.set(event, cb);
      return this;
    },
    removeListener(event, cb) {
      if (listeners.get(event) === cb) listeners.delete(event);
      return this;
    },
    writeHead(status, statusText, headers) {
      this.statusCode = status;
      this.statusText = statusText;
      this.headers = headers;
      this.headersSent = true;
    },
    setHeader() {},
    getHeader() {},
    end() {
      this.writableEnded = true;
      const finish = listeners.get('finish');
      if (finish) finish();
      const close = listeners.get('close');
      if (close) close();
    },
    write() {
      return true;
    },
    cork() {},
    uncork() {},
    flushHeaders() {},
  };
  return { req, res };
}

const adapter = createServerAdapter(() => Response.json({ hello: 'world' }), {
  __useCustomAbortCtrl: false,
  __useSingleWriteHead: true,
});

const mixedHeaders = {
  'Content-Type': 'application/json',
  Accept: '*/*',
  'X-Request-Id': 'abc',
  'Cache-Control': 'no-cache',
  Authorization: 'Bearer token',
  'User-Agent': 'bench',
  'Accept-Encoding': 'gzip',
  Connection: 'keep-alive',
};

const lowerHeaders = {
  'content-type': 'application/json',
  accept: '*/*',
  'x-request-id': 'abc',
  'cache-control': 'no-cache',
  authorization: 'Bearer token',
  'user-agent': 'bench',
  'accept-encoding': 'gzip',
  connection: 'keep-alive',
};

console.log(`Node ${process.version} | iters=${ITER} | gc=${!!global.gc}\n`);

measure('server requestListener (sync JSON)', () => {
  const { req, res } = makeNodeReqRes();
  adapter.requestListener(req, res);
});

measure('Headers.get lowercase object (8 keys)', () => {
  const h = new PonyfillHeaders(lowerHeaders);
  h.get('content-type');
  h.get('authorization');
  h.get('x-request-id');
  h.get('missing');
});

measure('Headers.get mixed-case object (8 keys)', () => {
  const h = new PonyfillHeaders(mixedHeaders);
  h.get('content-type');
  h.get('authorization');
  h.get('x-request-id');
  h.get('missing');
});

measure('Headers.entries array init', () => {
  const h = new PonyfillHeaders(Object.entries(lowerHeaders));
  for (const _ of h.entries()) {
    // drain
  }
});

{
  const stream = Readable.from([Buffer.from('{"a":1}')]);
  const res = new PonyfillResponse(stream, {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  // Measure repeated property access on one body (proxy/bind cache benefit)
  measure('Body proxy repeated method access', () => {
    const body = res.body;
    void body.on;
    void body.pipe;
    void body.destroy;
    void body.on;
    void body.pipe;
  });
}

// Allocation-focused: how much heap per N requestListener calls
{
  const N = 50_000;
  if (global.gc) global.gc();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < N; i++) {
    const { req, res } = makeNodeReqRes();
    adapter.requestListener(req, res);
  }
  if (global.gc) global.gc();
  const after = process.memoryUsage().heapUsed;
  const bytesPer = (after - before) / N;
  console.log(
    `${'requestListener heap/req (after GC)'.padEnd(42)} ${bytesPer.toFixed(1).padStart(10)} B/req   (${N} reqs)`,
  );
}
