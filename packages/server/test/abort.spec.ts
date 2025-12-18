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

      // #3011: aborting/erroring the response body must destroy the Node response and
      // close the socket (client sees RST / ECONNRESET). Exercise via raw node:http(s)
      // so we assert the socket, not fetch-client stream quirks. Skip libcurl/uWS.
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
          const pipeToErrored$ = createDeferredPromise<void>();

          try {
            const adapter = createServerAdapter(() => {
              const readable = new fetchAPI.ReadableStream({
                async pull(controller) {
                  await new Promise(resolve => setTimeout(resolve, 50));
                  controller.enqueue(new Uint8Array([1, 2, 3, 4]));
                },
              });
              const transform = new fetchAPI.TransformStream();
              readable.pipeTo(transform.writable, { signal: abortCtrl.signal }).catch(() => {
                pipeToErrored$.resolve();
              });
              return new fetchAPI.Response(transform.readable);
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
                  // ephemeral test CA is already in tls default store for node:https
                  rejectUnauthorized: url.protocol === 'https:' ? true : undefined,
                },
                res => {
                  res.once('data', () => {
                    // Abort the *response body* stream after bytes have started flowing
                    abortCtrl.abort();
                  });
                  // After destroy(), Node should RST / prematurely close the connection
                  res.on('aborted', settle);
                  res.on('error', settle);
                  res.on('close', settle);
                  res.on('end', settle);
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

            await pipeToErrored$.promise;

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
