/* eslint-disable n/no-callback-literal */
import { globalAgent as httpGlobalAgent } from 'http';
import { globalAgent as httpsGlobalAgent } from 'https';
import type { Dispatcher } from 'undici';
import { createFetch } from '@whatwg-node/fetch';
import { createServerAdapter } from '../src/createServerAdapter';
import { FetchAPI } from '../src/types';

const libcurl = globalThis.libcurl;
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
  describe('Ponyfill', () => {
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
    if (libcurl) {
      describe('libcurl', () => {
        const fetchAPI = createFetch({ skipPonyfill: false });
        callback('libcurl', {
          fetchAPI,
          createServerAdapter: (baseObj: any, opts?: any) =>
            createServerAdapter(baseObj, {
              fetchAPI,
              ...opts,
            }),
        });
        afterAll(() => {
          libcurl.Curl.globalCleanup();
        });
      });
    }
    describe('node-http', () => {
      beforeAll(() => {
        (globalThis.libcurl as any) = null;
      });
      afterAll(() => {
        globalThis.libcurl = libcurl;
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
  if (!opts.noNativeFetch) {
    describe('Native', () => {
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
        // @ts-expect-error TS types are not available yet but documented [here](https://github.com/nodejs/undici/discussions/2167#discussioncomment-6239992)
        const undiciGlobalDispatcher: Dispatcher =
          globalThis[Symbol.for('undici.globalDispatcher.1')];
        await undiciGlobalDispatcher?.close();
        await undiciGlobalDispatcher?.destroy();
        return new Promise<void>(resolve => {
          setTimeout(() => {
            resolve();
          }, 300);
        });
      });
    });
  }
  afterEach(() => {
    globalThis?.gc?.();
  });
}
