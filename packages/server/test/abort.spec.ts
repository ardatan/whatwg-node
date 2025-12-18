import { describe, it } from '@jest/globals';
import { runTestsForEachFetchImpl } from './test-fetch';
import { runTestsForEachServerImpl } from './test-server';

const skipIf = (condition: boolean) => (condition ? it.skip : it);

describe('Request Abort', () => {
  runTestsForEachServerImpl((server, serverImplName) => {
    runTestsForEachFetchImpl((_, { fetchAPI, createServerAdapter }) => {
      skipIf(
        (globalThis.Bun && serverImplName !== 'Bun') ||
          (globalThis.Deno && serverImplName !== 'Deno'),
      )(
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

      skipIf(
        (globalThis.Bun && serverImplName !== 'Bun') ||
          (globalThis.Deno && serverImplName !== 'Deno'),
      )(
        'aborting response stream closes the socket',
        () =>
          new Promise<void>((resolve, reject) => {
            const abortCtrl = new AbortController();
            let pipeToError: any;
            const adapter = createServerAdapter(() => {
              const readable = new fetchAPI.ReadableStream({
                async pull(controller) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                  controller.enqueue(new Uint8Array([1, 2, 3, 4]));
                },
              });
              const transform = new fetchAPI.TransformStream();
              readable.pipeTo(transform.writable, { signal: abortCtrl.signal }).catch(err => {
                pipeToError = err;
              });
              return new fetchAPI.Response(transform.readable);
            });

            server.addOnceHandler(adapter);

            fetchAPI.fetch(server.url).then(
              async response => {
                const reader = response.body?.getReader();

                if (!reader) {
                  reject(new Error('No response body'));
                  return;
                }

                // start reading the body
                await reader.read();

                // cancel the response
                abortCtrl.abort();

                try {
                  while (true) {
                    const { done } = await reader.read();
                    if (done) break;
                  }
                  reject(new Error('Expected reader to be closed'));
                } catch (err) {
                  if (!pipeToError) {
                    reject(new Error('Expected pipeTo to error'));
                    return;
                  }
                  resolve();
                }
              },
              err => {
                reject(err);
              },
            );
          }),
        2000,
      );
    });
  });
});
