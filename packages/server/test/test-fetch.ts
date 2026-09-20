/* eslint-disable n/no-callback-literal */
import { globalAgent as httpGlobalAgent } from 'node:http';
import { globalAgent as httpsGlobalAgent } from 'node:https';
import { setTimeout } from 'node:timers/promises';
import type { Dispatcher } from 'undici';
import { afterAll, afterEach, describe } from '@jest/globals';
import { patchSymbols } from '@whatwg-node/disposablestack';
import { createFetch } from '@whatwg-node/fetch';
import { createServerAdapter } from '../src/createServerAdapter';
import { FetchAPI } from '../src/types';

patchSymbols();
const describeIf = (condition: boolean) => (condition ? describe : describe.skip);
export function runTestsForEachFetchImpl(
  callback: (
    implementationName: string,
    api: {
      fetchAPI: FetchAPI;
      createServerAdapter: typeof createServerAdapter;
    },
  ) => void,
  opts: { noNativeFetch?: boolean } = {},
) {
  describeIf(!globalThis.Deno)('Ponyfill', () => {
    describe('node-http', () => {
      afterAll(() => {
        httpGlobalAgent.destroy();
        httpsGlobalAgent.destroy();
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
}
