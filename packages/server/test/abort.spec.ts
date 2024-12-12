import { runTestsForEachFetchImpl } from './test-fetch';
import { runTestsForEachServerImpl } from './test-server';

describe('Request Abort', () => {
  runTestsForEachServerImpl((server, _) => {
    runTestsForEachFetchImpl((_, { fetchAPI, createServerAdapter }) => {
      it('calls body.cancel on request abort', done => {
        const adapter = createServerAdapter(
          () =>
            new fetchAPI.Response(
              new fetchAPI.ReadableStream({
                cancel() {
                  done();
                },
              }),
            ),
        );
        server.addOnceHandler(adapter);
        const abortCtrl = new fetchAPI.AbortController();
        fetchAPI.fetch(server.url, { signal: abortCtrl.signal }).then(
          () => {},
          () => {},
        );
        setTimeout(() => {
          abortCtrl.abort();
        }, 300);
      });
    });
  });
});
