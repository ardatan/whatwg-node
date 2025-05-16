import { createServer, RequestListener } from 'node:http';
import { AddressInfo } from 'node:net';
import { bench, BenchOptions, describe } from 'vitest';
import { fetch } from '@whatwg-node/fetch';
import { createServerAdapter, Response } from '@whatwg-node/server';

const isCI = !!process.env['CI'];

function useNumberEnv(envName: string, defaultValue: number): number {
  const value = process.env[envName];
  if (!value) {
    return defaultValue;
  }
  return parseInt(value, 10);
}

const duration = useNumberEnv('BENCH_DURATION', isCI ? 60000 : 15000);
const warmupTime = useNumberEnv('BENCH_WARMUP_TIME', isCI ? 10000 : 5000);
const warmupIterations = useNumberEnv('BENCH_WARMUP_ITERATIONS', isCI ? 30 : 10);
const benchConfig: BenchOptions = {
  time: duration,
  warmupTime,
  warmupIterations,
  throws: true,
};

function benchForAdapter(name: string, adapter: RequestListener) {
  const server = (createServer(adapter).listen(0).address() as AddressInfo).port;

  bench(name, () => fetch(`http://localhost:${server}`).then(res => res.json()), benchConfig);
}

const adapters = {
  'without custom abort ctrl and without single write head': createServerAdapter(
    () => Response.json({ hello: 'world' }),
    {
      __useCustomAbortCtrl: false,
      __useSingleWriteHead: false,
    },
  ),
  'with custom abort ctrl and without single write head': createServerAdapter(
    () => Response.json({ hello: 'world' }),
    {
      __useCustomAbortCtrl: true,
      __useSingleWriteHead: false,
    },
  ),
  'with custom abort ctrl and with single write head': createServerAdapter(
    () => Response.json({ hello: 'world' }),
    {
      __useCustomAbortCtrl: true,
      __useSingleWriteHead: true,
    },
  ),
  'without custom abort ctrl and with single write head': createServerAdapter(
    () => Response.json({ hello: 'world' }),
    {
      __useCustomAbortCtrl: false,
      __useSingleWriteHead: true,
    },
  ),
};

/* Randomize array in-place using Durstenfeld shuffle algorithm */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

describe('Simple JSON Response', () => {
  const adapterEntries = shuffleArray([...Object.entries(adapters)]);
  for (const [benchName, adapter] of adapterEntries) {
    benchForAdapter(benchName, adapter);
  }
});
