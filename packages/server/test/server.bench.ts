import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { bench, BenchOptions, describe } from 'vitest';
import { createServerAdapter, Response } from '@whatwg-node/server';

const isCI = !!process.env['CI'];

function useNumberEnv(envName: string, defaultValue: number): number {
  const value = process.env[envName];
  if (!value) {
    return defaultValue;
  }
  return parseInt(value, 10);
}

const duration = useNumberEnv('BENCH_DURATION', isCI ? 30000 : 5000);
const warmupTime = useNumberEnv('BENCH_WARMUP_TIME', isCI ? 5000 : 1000);
const warmupIterations = useNumberEnv('BENCH_WARMUP_ITERATIONS', isCI ? 10 : 5);
const benchConfig: BenchOptions = {
  time: duration,
  warmupTime,
  warmupIterations,
  throws: true,
};

describe('Simple JSON Response', () => {
  const simpleNodeServer = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ hello: 'world' }));
  });
  const simpleNodePort = (simpleNodeServer.listen(0).address() as AddressInfo).port;
  bench(
    'node:http',
    () => fetch(`http://localhost:${simpleNodePort}`).then(res => res.json()),
    benchConfig,
  );

  const whatwgNodeServerWithPonyfills = (
    createServer(createServerAdapter(() => Response.json({ hello: 'world' })))
      .listen(0)
      .address() as AddressInfo
  ).port;

  bench(
    '@whatwg-node/server w/ ponyfills',
    () => fetch(`http://localhost:${whatwgNodeServerWithPonyfills}`).then(res => res.json()),
    benchConfig,
  );

  const whatwgNodeWithNative = (
    createServer(
      createServerAdapter(() => globalThis.Response.json({ hello: 'world ' }), {
        fetchAPI: globalThis,
      }),
    )
      .listen(0)
      .address() as AddressInfo
  ).port;
  bench(
    '@whatwg-node/server w/ native',
    () => fetch(`http://localhost:${whatwgNodeWithNative}`).then(res => res.json()),
    benchConfig,
  );
});
