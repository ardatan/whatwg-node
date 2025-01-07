import { describe, expect, it } from '@jest/globals';
import { runTestsForEachFetchImpl } from './test-fetch';
import { runTestsForEachServerImpl } from './test-server';

describe('Request Abort', () => {
  runTestsForEachServerImpl(server => {
    runTestsForEachFetchImpl((_, { fetchAPI, createServerAdapter }) => {
      it(
        'calls body.cancel on request abort',
        () =>
          new Promise<void>(resolve => {
            const adapter = createServerAdapter(
              () =>
                new fetchAPI.Response(
                  new fetchAPI.ReadableStream({
                    cancel() {
                      resolve();
                    },
                  }),
                ),
            );
            server.addOnceHandler(adapter);
            const abortCtrl = new AbortController();
            fetchAPI.fetch(server.url, { signal: abortCtrl.signal }).then(
              () => {},
              () => {},
            );
            setTimeout(() => {
              abortCtrl.abort();
            }, 300);
          }),
        1000,
      );
    });
  });
});
