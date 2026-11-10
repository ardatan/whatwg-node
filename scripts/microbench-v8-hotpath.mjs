/**
 * Isolated allocator / hot-path microbenchmarks for candidate V8 opts.
 * Run: node --expose-gc scripts/microbench-v8-hotpath.mjs
 */
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);

function gc() {
  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
  }
}

function heapUsed() {
  return process.memoryUsage().heapUsed;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatMs(ms) {
  return `${ms.toFixed(1)} ms`;
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function measureOnce(fn, retain) {
  gc();
  const before = heapUsed();
  const t0 = performance.now();
  const retained = fn();
  const dt = performance.now() - t0;
  const after = heapUsed();
  if (!retain && Array.isArray(retained)) retained.length = 0;
  return { dt, heap: Math.max(0, after - before) };
}

function pairedRun(name, aLabel, bLabel, aFn, bFn, { runs = 7, retain = false } = {}) {
  const aElapsed = [];
  const bElapsed = [];
  const aHeap = [];
  const bHeap = [];
  const order = [];

  for (let i = 0; i < runs; i++) {
    // Alternate A/B so allocator / JIT warm-up from one side does not bias every sample.
    const aFirst = i % 2 === 0;
    order.push(aFirst ? 'AB' : 'BA');
    if (aFirst) {
      const a = measureOnce(aFn, retain);
      aElapsed.push(a.dt);
      aHeap.push(a.heap);
      const b = measureOnce(bFn, retain);
      bElapsed.push(b.dt);
      bHeap.push(b.heap);
    } else {
      const b = measureOnce(bFn, retain);
      bElapsed.push(b.dt);
      bHeap.push(b.heap);
      const a = measureOnce(aFn, retain);
      aElapsed.push(a.dt);
      aHeap.push(a.heap);
    }
  }

  const aMedE = median(aElapsed);
  const bMedE = median(bElapsed);
  const aMedH = median(aHeap);
  const bMedH = median(bHeap);
  const eImp = ((aMedE - bMedE) / aMedE) * 100;
  const hImp = aMedH === 0 ? 0 : ((aMedH - bMedH) / aMedH) * 100;

  console.log(`\n=== ${name} ===`);
  console.log(
    `| Variant | Median elapsed | Median heap delta |\n| --- | ---: | ---: |\n| ${aLabel} | ${formatMs(aMedE)} | ${formatMb(aMedH)} |\n| ${bLabel} | ${formatMs(bMedE)} | ${formatMb(bMedH)} |\n| Improvement | ${eImp.toFixed(1)}% | ${hImp.toFixed(1)}% |`,
  );
  console.log(`order: ${order.join(' ')}`);

  return { aMedE, bMedE, aMedH, bMedH, eImp, hImp, order };
}

// --- fakePromise: object literal vs prototype class ---

const kFakePromise = Symbol.for('@whatwg-node/promise-helpers/FakePromise');

function fakePromiseLiteral(value) {
  return {
    then(resolve) {
      if (resolve) {
        try {
          return fakePromiseLiteral(resolve(value));
        } catch (err) {
          return fakeRejectLiteral(err);
        }
      }
      return this;
    },
    catch() {
      return this;
    },
    finally(cb) {
      if (cb) {
        try {
          return fakePromiseLiteral(cb()).then(
            () => value,
            () => value,
          );
        } catch (err) {
          return fakeRejectLiteral(err);
        }
      }
      return this;
    },
    [Symbol.toStringTag]: 'Promise',
    __fakePromiseValue: value,
    [kFakePromise]: 'resolved',
  };
}

function fakeRejectLiteral(error) {
  return {
    then(_resolve, reject) {
      if (reject) {
        try {
          return fakePromiseLiteral(reject(error));
        } catch (err) {
          return fakeRejectLiteral(err);
        }
      }
      return this;
    },
    catch(reject) {
      if (reject) {
        try {
          return fakePromiseLiteral(reject(error));
        } catch (err) {
          return fakeRejectLiteral(err);
        }
      }
      return this;
    },
    finally(cb) {
      if (cb) {
        try {
          cb();
        } catch (err) {
          return fakeRejectLiteral(err);
        }
      }
      return this;
    },
    __fakeRejectError: error,
    [Symbol.toStringTag]: 'Promise',
    [kFakePromise]: 'rejected',
  };
}

class FakePromise {
  constructor(value) {
    this.__fakePromiseValue = value;
    this[kFakePromise] = 'resolved';
  }
  then(resolve) {
    if (resolve) {
      try {
        return new FakePromise(resolve(this.__fakePromiseValue));
      } catch (err) {
        return new FakeRejectPromise(err);
      }
    }
    return this;
  }
  catch() {
    return this;
  }
  finally(cb) {
    if (cb) {
      try {
        return new FakePromise(cb()).then(
          () => this.__fakePromiseValue,
          () => this.__fakePromiseValue,
        );
      } catch (err) {
        return new FakeRejectPromise(err);
      }
    }
    return this;
  }
  get [Symbol.toStringTag]() {
    return 'Promise';
  }
}

class FakeRejectPromise {
  constructor(error) {
    this.__fakeRejectError = error;
    this[kFakePromise] = 'rejected';
  }
  then(_resolve, reject) {
    if (reject) {
      try {
        return new FakePromise(reject(this.__fakeRejectError));
      } catch (err) {
        return new FakeRejectPromise(err);
      }
    }
    return this;
  }
  catch(reject) {
    if (reject) {
      try {
        return new FakePromise(reject(this.__fakeRejectError));
      } catch (err) {
        return new FakeRejectPromise(err);
      }
    }
    return this;
  }
  finally(cb) {
    if (cb) {
      try {
        cb();
      } catch (err) {
        return new FakeRejectPromise(err);
      }
    }
    return this;
  }
  get [Symbol.toStringTag]() {
    return 'Promise';
  }
}

const N_FAKE = 300_000;

const fakeAlloc = pairedRun(
  `fakePromise allocate N=${N_FAKE} (retain all)`,
  'object-literal',
  'class+prototype',
  () => {
    const arr = new Array(N_FAKE);
    for (let i = 0; i < N_FAKE; i++) arr[i] = fakePromiseLiteral(i);
    return arr;
  },
  () => {
    const arr = new Array(N_FAKE);
    for (let i = 0; i < N_FAKE; i++) arr[i] = new FakePromise(i);
    return arr;
  },
  { retain: true },
);

const fakeThen = pairedRun(
  `fakePromise.then(identity) N=${N_FAKE} (no retain)`,
  'object-literal',
  'class+prototype',
  () => {
    for (let i = 0; i < N_FAKE; i++) {
      fakePromiseLiteral(i).then(v => v);
    }
  },
  () => {
    for (let i = 0; i < N_FAKE; i++) {
      new FakePromise(i).then(v => v);
    }
  },
);

// --- Buffer.from double vs single (uWS onData pattern) ---

const N_BUF = 50_000;
const ab = new ArrayBuffer(4 * 1024);

// uWS recycles the ArrayBuffer; a bare single Buffer.from(ab) is a view and is
// incorrect. Compare double-from (view+copy) vs allocUnsafe+set (one copy).
const bufCopy = pairedRun(
  `uWS-safe Buffer copy N=${N_BUF} x 4KiB (CPU only)`,
  'double Buffer.from (view+copy)',
  'allocUnsafe + set',
  () => {
    let sink = 0;
    for (let i = 0; i < N_BUF; i++) {
      const buf = Buffer.from(Buffer.from(ab, 0, ab.byteLength));
      sink ^= buf[0];
    }
    return sink;
  },
  () => {
    let sink = 0;
    for (let i = 0; i < N_BUF; i++) {
      const buf = Buffer.allocUnsafe(ab.byteLength);
      buf.set(new Uint8Array(ab));
      sink ^= buf[0];
    }
    return sink;
  },
);

// --- Body-like Proxy vs cached facade ---

function makeReadableLike() {
  return {
    readable: true,
    pipe() {},
    destroy() {},
    on() {
      return this;
    },
    once() {
      return this;
    },
  };
}

function makePonyfillLike() {
  return {
    getReader() {
      return { read: async () => ({ done: true, value: undefined }) };
    },
    cancel() {
      return Promise.resolve();
    },
    tee() {
      return [this, this];
    },
  };
}

function bodyViaProxy(ponyfill, readable) {
  return new Proxy(readable, {
    get(_, prop) {
      if (prop in ponyfill) {
        const v = ponyfill[prop];
        return typeof v === 'function' ? v.bind(ponyfill) : v;
      }
      if (prop in readable) {
        const v = readable[prop];
        return typeof v === 'function' ? v.bind(readable) : v;
      }
    },
  });
}

function bodyViaCachedFacade(ponyfill, readable) {
  // Pre-bound methods, fixed shape - closer to a stable hidden class
  return {
    getReader: ponyfill.getReader.bind(ponyfill),
    cancel: ponyfill.cancel.bind(ponyfill),
    tee: ponyfill.tee.bind(ponyfill),
    pipe: readable.pipe.bind(readable),
    destroy: readable.destroy.bind(readable),
    on: readable.on.bind(readable),
    once: readable.once.bind(readable),
    readable: readable.readable,
  };
}

const N_BODY = 200_000;

/** Sink so property reads cannot be DCE'd away by V8. */
function touch(body) {
  return typeof body.getReader;
}

const bodyCachedProxy = pairedRun(
  `body Proxy allocate+getReader N=${N_BODY}`,
  'Proxy per access',
  'cached Proxy (shipped)',
  () => {
    const pony = makePonyfillLike();
    const readable = makeReadableLike();
    let sink = 0;
    for (let i = 0; i < N_BODY; i++) {
      const body = bodyViaProxy(pony, readable);
      sink += touch(body).length;
    }
    return sink;
  },
  () => {
    const pony = makePonyfillLike();
    const readable = makeReadableLike();
    // Matches Body.ts: build the Proxy once, reuse while the readable is unchanged.
    const body = bodyViaProxy(pony, readable);
    let sink = 0;
    for (let i = 0; i < N_BODY; i++) {
      sink += touch(body).length;
    }
    return sink;
  },
);

const bodyProxy = pairedRun(
  `body facade allocate+getReader N=${N_BODY}`,
  'Proxy per access',
  'cached plain facade',
  () => {
    const pony = makePonyfillLike();
    const readable = makeReadableLike();
    let sink = 0;
    for (let i = 0; i < N_BODY; i++) {
      const body = bodyViaProxy(pony, readable);
      sink += touch(body).length;
    }
    return sink;
  },
  () => {
    const pony = makePonyfillLike();
    const readable = makeReadableLike();
    const body = bodyViaCachedFacade(pony, readable);
    let sink = 0;
    for (let i = 0; i < N_BODY; i++) {
      sink += touch(body).length;
    }
    return sink;
  },
);

const bodyProxyFresh = pairedRun(
  `body facade fresh each time N=${N_BODY}`,
  'Proxy each time',
  'plain facade each time',
  () => {
    const pony = makePonyfillLike();
    const readable = makeReadableLike();
    let sink = 0;
    for (let i = 0; i < N_BODY; i++) {
      const body = bodyViaProxy(pony, readable);
      sink += touch(body).length;
    }
    return sink;
  },
  () => {
    const pony = makePonyfillLike();
    const readable = makeReadableLike();
    let sink = 0;
    for (let i = 0; i < N_BODY; i++) {
      const body = bodyViaCachedFacade(pony, readable);
      sink += touch(body).length;
    }
    return sink;
  },
);

console.log('\n=== Verdict thresholds (heuristic) ===');
const verdicts = [];
function verdict(label, result, minElapsedPct = 10) {
  const win = result.eImp >= minElapsedPct || result.hImp >= 20;
  verdicts.push({ label, win, eImp: result.eImp, hImp: result.hImp });
  console.log(
    `${win ? 'KEEP' : 'SKIP '}: ${label} (elapsed ${result.eImp.toFixed(1)}%, heap ${result.hImp.toFixed(1)}%)`,
  );
}

verdict('fakePromise class+prototype (alloc)', fakeAlloc, 15);
verdict('fakePromise class+prototype (then)', fakeThen, 10);
// Correctness-preserving uWS copy rarely wins enough to ship (~5% noise).
verdict('uWS allocUnsafe+set vs double from', bufCopy, 25);
verdict('Body cached Proxy vs Proxy per access', bodyCachedProxy, 20);
verdict('Body cached facade vs Proxy', bodyProxy, 20);
verdict('Body plain facade vs Proxy (fresh)', bodyProxyFresh, 10);

const keep = verdicts.filter(v => v.win);
console.log(`\nCandidates to implement: ${keep.map(v => v.label).join(', ') || '(none)'}`);
