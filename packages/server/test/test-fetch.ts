/* eslint-disable n/no-callback-literal */
import { globalAgent as httpGlobalAgent } from 'node:http';
import { globalAgent as httpsGlobalAgent } from 'node:https';
import { setTimeout } from 'node:timers/promises';
import type { Dispatcher } from 'undici';
import { afterAll, afterEach, beforeAll, describe } from '@jest/globals';
import { patchSymbols } from '@whatwg-node/disposablestack';
import { createFetch } from '@whatwg-node/fetch';
import { closeSharedUndiciAgent } from '../../node-fetch/src/fetchUndici';
import { getUndici } from '../../node-fetch/src/getUndici';
import { createServerAdapter } from '../src/createServerAdapter';
import { FetchAPI } from '../src/types';

patchSymbols();
const describeIf = (condition: boolean) => (condition ? describe : describe.skip);
const DISABLE_UNDICI = Symbol.for('whatwg-node.disable-undici');

export function runTestsForEachFetchImpl(
  callback: (
    implementationName: string,
    api: {
      fetchAPI: FetchAPI;
      createServerAdapter: typeof createServerAdapter;
    },
  ) => void,
  opts: { noNativeFetch?: boolean; noUndici?: boolean } = {},
) {
  // Resolve lazily so merely importing this helper (e.g. a LEAK_TEST-skipped
  // suite) does not load undici into the Jest isolate.
  const undiciAvailable = !opts.noUndici && !!getUndici();
  describeIf(!globalThis.Deno)('Ponyfill', () => {
    describeIf(undiciAvailable)('undici', () => {
      beforeAll(() => {
        (globalThis as Record<symbol, unknown>)[DISABLE_UNDICI] = false;
      });
      afterEach(async () => {
        if (process.env.LEAK_TEST) {
          await closeSharedUndiciAgent();
          globalThis.gc?.();
        }
      });
      afterAll(async () => {
        await closeSharedUndiciAgent();
        globalThis.gc?.();
      });
      const fetchAPI = createFetch({ skipPonyfill: false });
      callback('undici', {
        fetchAPI,
        createServerAdapter: (baseObj: any, opts?: any) =>
          createServerAdapter(baseObj, {
            fetchAPI,
            ...opts,
          }),
      });
    });
    describe('node-http', () => {
      beforeAll(() => {
        (globalThis as Record<symbol, unknown>)[DISABLE_UNDICI] = true;
      });
      afterAll(() => {
        httpGlobalAgent.destroy();
        httpsGlobalAgent.destroy();
        (globalThis as Record<symbol, unknown>)[DISABLE_UNDICI] = false;
      });
      const fetchAPI = createFetch({ skipPonyfill: false });
      callback('node-http', {
        fetchAPI,
        createServerAdapter: (baseObj: any, opts?: any) =>
          createServerAdapter(baseObj, {
            fetchAPI,
            ...opts,
          }),
      });
    });
  });
  let noNative = opts.noNativeFetch;
  if (
    process.env.LEAK_TEST &&
    // @ts-expect-error - Only if global dispatcher is available
    !globalThis[Symbol.for('undici.globalDispatcher.1')]
  ) {
    noNative = true;
  }
  describeIf(!noNative || globalThis.Bun || globalThis.Deno)('Native', () => {
    const fetchAPI = createFetch({ skipPonyfill: true });
    callback('native', {
      fetchAPI,
      createServerAdapter: (baseObj: any, opts?: any) =>
        createServerAdapter(baseObj, {
          fetchAPI,
          ...opts,
        }),
    });
    afterEach(async () => {
      const undiciGlobalDispatcher: Dispatcher =
        // @ts-expect-error TS types are not available yet but documented [here](https://github.com/nodejs/undici/discussions/2167#discussioncomment-6239992)
        globalThis[Symbol.for('undici.globalDispatcher.1')];
      await undiciGlobalDispatcher?.close();
      await undiciGlobalDispatcher?.destroy();
      return setTimeout(300);
    });
  });
  afterEach(() => {
    globalThis?.gc?.();
  });
  afterAll(async () => {
    if (!process.env.LEAK_TEST) {
      return;
    }
    await closeSharedUndiciAgent();
    globalThis.gc?.();
    await setTimeout(100);
    globalThis.gc?.();
  });
}
