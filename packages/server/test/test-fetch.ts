/* eslint-disable n/no-callback-literal */
import { globalAgent as httpGlobalAgent } from 'node:http';
import { globalAgent as httpsGlobalAgent } from 'node:https';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import type { Dispatcher } from 'undici';
import { afterAll, afterEach, beforeAll, describe } from '@jest/globals';
import { patchSymbols } from '@whatwg-node/disposablestack';
import { createFetch } from '@whatwg-node/fetch';
import { disposeLibcurlMulti } from '@whatwg-node/node-fetch';
import { createServerAdapter } from '../src/createServerAdapter';
import { FetchAPI } from '../src/types';

patchSymbols();
const describeIf = (condition: boolean) => (condition ? describe : describe.skip);
const libcurl = globalThis.libcurl;

if (libcurl) {
  // CloseTimerAsync is not exposed from Multi.close() in node-libcurl 5; wire the
  // monorepo helper so disposeLibcurlMulti / Curl.globalCleanup can Unref the Multi.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fix = require(join(__dirname, '../../../scripts/libcurl-multi-fix')) as {
    closeMultiTimer: (multi: unknown, bindingPath: string) => void;
  };
  const bindingPath = require.resolve('node-libcurl/lib/binding/node_libcurl.node');
  (
    globalThis as typeof globalThis & {
      __whatwgNodeReleaseLibcurlMultiTimer?: (multi: unknown) => void;
    }
  ).__whatwgNodeReleaseLibcurlMultiTimer = multi => {
    fix.closeMultiTimer(multi, bindingPath);
  };
}

export function runTestsForEachFetchImpl(
  callback: (
    implementationName: string,
    api: {
      fetchAPI: FetchAPI;
      createServerAdapter: typeof createServerAdapter;
    },
  ) => void,
  opts: { noLibCurl?: boolean; noNativeFetch?: boolean } = {},
) {
  describeIf(!globalThis.Deno)('Ponyfill', () => {
    if (opts.noLibCurl) {
      const fetchAPI = createFetch({ skipPonyfill: false });
      callback('ponyfill', {
        fetchAPI,
        createServerAdapter: (baseObj: any, opts?: any) =>
          createServerAdapter(baseObj, {
            fetchAPI,
            ...opts,
          }),
      });
      return;
    }
    describeIf(libcurl)('libcurl', () => {
      const fetchAPI = createFetch({ skipPonyfill: false });
      callback('libcurl', {
        fetchAPI,
        createServerAdapter: (baseObj: any, opts?: any) =>
          createServerAdapter(baseObj, {
            fetchAPI,
            ...opts,
          }),
      });
      afterAll(async () => {
        // Drain deferred Multi removeHandle/onEnd, wait for empty pool, then dispose
        // app-owned Multi (+ process-default Multi if any) including CloseTimerAsync.
        await disposeLibcurlMulti();
        libcurl.Curl.globalCleanup();
        for (let i = 0; i < 20; i++) {
          await new Promise<void>(resolve => setImmediate(resolve));
        }
        await new Promise<void>(resolve => setTimeout(resolve, 50));
        globalThis.gc?.();
      });
    });
    describe('node-http', () => {
      beforeAll(() => {
        (globalThis.libcurl as any) = null;
      });
      afterEach(() => {
        httpGlobalAgent.destroy();
        httpsGlobalAgent.destroy();
      });
      afterAll(() => {
        httpGlobalAgent.destroy();
        httpsGlobalAgent.destroy();
        globalThis.libcurl = libcurl;
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
