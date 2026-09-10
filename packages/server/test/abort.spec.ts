import http from 'node:http';
import https from 'node:https';
import { describe, expect, it } from '@jest/globals';
import { createDeferredPromise } from '@whatwg-node/promise-helpers';
import { runTestsForEachFetchImpl } from './test-fetch';
import { runTestsForEachServerImpl } from './test-server';

const skipIf = (condition: boolean) => (condition ? it.skip : it);

describe('Request Abort', () => {
  runTestsForEachServerImpl((server, serverImplName) => {
    runTestsForEachFetchImpl((implementationName, { fetchAPI, createServerAdapter }) => {
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

      // #3011: error/abort on the response body must destroy the Node response and
      // close the socket (client sees RST / ECONNRESET). Use raw node:http(s) so we
      // assert the socket itself. Skip libcurl/uWS/Bun/Deno (different write paths).
      skipIf(
        implementationName === 'libcurl' ||
          serverImplName === 'uWebSockets' ||
          serverImplName === 'Bun' ||
          serverImplName === 'Deno' ||
          (globalThis.Bun && serverImplName !== 'Bun') ||
          (globalThis.Deno && serverImplName !== 'Deno'),
      )(
        'aborting response stream closes the socket',
        async () => {
          const unexpectedLogs: string[] = [];
          const originalConsoleError = console.error;
          console.error = (...args: unknown[]) => {
            unexpectedLogs.push(args.map(String).join(' '));
          };

          const abortCtrl = new AbortController();
          const bodyErrored$ = createDeferredPromise<void>();

          try {
            const adapter = createServerAdapter(() => {
              let streamController: ReadableStreamDefaultController<Uint8Array>;
              const body = new fetchAPI.ReadableStream<Uint8Array>({
                start(controller) {
                  streamController = controller;
                  abortCtrl.signal.addEventListener(
                    'abort',
                    () => {
                      streamController.error(
                        abortCtrl.signal.reason instanceof Error
                          ? abortCtrl.signal.reason
                          : new Error('response body aborted'),
                      );
                      bodyErrored$.resolve();
                    },
                    { once: true },
                  );
                },
                async pull(controller) {
                  await new Promise(resolve => setTimeout(resolve, 50));
                  controller.enqueue(new Uint8Array([1, 2, 3, 4]));
                },
              });
              return new fetchAPI.Response(body);
            });

            await server.addOnceHandler(adapter);

            const url = new URL(server.url);
            const transport = url.protocol === 'https:' ? https : http;

            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(
                () => reject(new Error('socket did not close after response body abort')),
                2000,
              );

              const settle = () => {
                clearTimeout(timeout);
                resolve();
              };

              const req = transport.get(
                {
                  hostname: url.hostname,
                  port: url.port,
                  path: url.pathname + url.search,
                },
                res => {
                  res.once('data', () => {
                    // Abort/error the response body after bytes have started flowing
                    abortCtrl.abort();
                  });
                  // After destroy(), Node should RST / prematurely close the connection.
                  // Do not treat a normal completed response (end / complete close) as success.
                  res.on('aborted', settle);
                  res.on('error', settle);
                  res.on('close', () => {
                    if (!res.complete) {
                      settle();
                    }
                  });
                  res.on('end', () => {
                    clearTimeout(timeout);
                    reject(new Error('response ended cleanly; expected socket abort/reset'));
                  });
                },
              );

              req.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED') {
                  settle();
                  return;
                }
                clearTimeout(timeout);
                reject(err);
              });
            });

            await bodyErrored$.promise;

            expect(
              unexpectedLogs.some(log => log.includes('Unexpected error while handling request')),
            ).toBe(false);
          } finally {
            console.error = originalConsoleError;
            if (!abortCtrl.signal.aborted) {
              abortCtrl.abort();
            }
          }
        },
        4000,
      );
    });
  });
});
