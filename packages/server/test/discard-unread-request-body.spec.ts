import http, { request as httpRequest, IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { describe, expect, it } from '@jest/globals';
import { createDeferredPromise } from '@whatwg-node/promise-helpers';
import { runTestsForEachFetchImpl } from './test-fetch.js';
import { runTestsForEachServerImpl } from './test-server.js';

const skipIf = (condition: boolean) => (condition ? it.skip : it);

function requestForUrl(
  url: URL,
  options: http.RequestOptions,
  cb?: (res: IncomingMessage) => void,
) {
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return request(
    {
      ...options,
      protocol: url.protocol,
      hostname: options.hostname ?? url.hostname,
      port: options.port ?? url.port,
    },
    cb,
  );
}

describe('Discard unread request body', () => {
  runTestsForEachFetchImpl((_impl, { createServerAdapter, fetchAPI }) => {
    runTestsForEachServerImpl((testServer, serverImplName) => {
      const skipNativeRuntimes =
        (globalThis.Bun && serverImplName !== 'Bun') ||
        (globalThis.Deno && serverImplName !== 'Deno');

      // Assert IncomingMessage flowing/ended — Node http(s) + express (requestListener path).
      skipIf(
        skipNativeRuntimes ||
          serverImplName === 'uWebSockets' ||
          serverImplName === 'Bun' ||
          serverImplName === 'Deno' ||
          serverImplName === 'fastify' ||
          serverImplName === 'koa' ||
          serverImplName === 'hapi',
      )('drains unread request body while a streaming response is still open', async () => {
        const midStream$ = createDeferredPromise<{
          readableFlowing: boolean | null;
          readableEnded: boolean;
        }>();

        const adapter = createServerAdapter((_request, ctx) => {
          const nodeReq = (ctx as { req?: IncomingMessage }).req;
          setTimeout(() => {
            midStream$.resolve({
              readableFlowing: nodeReq?.readableFlowing ?? null,
              readableEnded: nodeReq?.readableEnded ?? false,
            });
          }, 60);

          return new fetchAPI.Response(
            new fetchAPI.ReadableStream<Uint8Array>({
              start(controller) {
                const id = setInterval(() => {
                  controller.enqueue(new TextEncoder().encode('x'));
                }, 20);
                setTimeout(() => {
                  clearInterval(id);
                  controller.close();
                }, 200);
              },
            }),
          );
        });

        await testServer.addOnceHandler(adapter);

        const url = new URL(testServer.url);
        const body = Buffer.alloc(50_000, 'a');

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('response timed out')), 5000);
          const req = requestForUrl(
            url,
            {
              path: url.pathname + url.search,
              method: 'POST',
              headers: {
                'content-length': body.length,
                'content-type': 'application/octet-stream',
                connection: 'keep-alive',
              },
            },
            res => {
              res.resume();
              res.on('end', () => {
                clearTimeout(timeout);
                resolve();
              });
            },
          );
          req.on('error', reject);
          req.end(body);
        });

        const state = await midStream$.promise;
        // Discard puts the request into flowing mode (and typically ends it) before the
        // streaming response finishes — Node's default would leave flowing === null until finish.
        expect(state.readableFlowing === true || state.readableEnded === true).toBe(true);
      });

      // Node resume() + uWS drain-only onData: streaming response must finish with a large
      // unread upload still on the wire (no hang waiting for the body).
      skipIf(skipNativeRuntimes || serverImplName === 'Bun' || serverImplName === 'Deno')(
        'finishes a streaming response without reading a large request body',
        async () => {
          const adapter = createServerAdapter(
            () =>
              new fetchAPI.Response(
                new fetchAPI.ReadableStream<Uint8Array>({
                  start(controller) {
                    const id = setInterval(() => {
                      controller.enqueue(new TextEncoder().encode('x'));
                    }, 20);
                    setTimeout(() => {
                      clearInterval(id);
                      controller.close();
                    }, 150);
                  },
                }),
              ),
          );
          await testServer.addOnceHandler(adapter);

          const url = new URL(testServer.url);
          const body = Buffer.alloc(200_000, 'a');
          const chunks: Buffer[] = [];

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('streaming response hung')), 5000);
            const req = requestForUrl(
              url,
              {
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                  'content-length': body.length,
                  'content-type': 'application/octet-stream',
                  connection: 'keep-alive',
                },
              },
              res => {
                expect(res.statusCode).toBe(200);
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                  clearTimeout(timeout);
                  resolve();
                });
              },
            );
            req.on('error', err => {
              clearTimeout(timeout);
              reject(err);
            });
            req.end(body);
          });

          expect(Buffer.concat(chunks).length).toBeGreaterThan(0);
        },
      );

      skipIf(skipNativeRuntimes || serverImplName === 'Bun' || serverImplName === 'Deno')(
        'still reads the full request body when the handler consumes it',
        async () => {
          const adapter = createServerAdapter(async request => {
            const text = await request.text();
            return new fetchAPI.Response(String(text.length), { status: 200 });
          });
          await testServer.addOnceHandler(adapter);

          const url = new URL(testServer.url);
          const body = Buffer.alloc(50_000, 'c');

          const statusAndBody = await new Promise<{ status?: number; text: string }>(
            (resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('body-read request hung')), 5000);
              const chunks: Buffer[] = [];
              const req = requestForUrl(
                url,
                {
                  path: url.pathname + url.search,
                  method: 'POST',
                  headers: {
                    'content-length': body.length,
                    'content-type': 'application/octet-stream',
                  },
                },
                res => {
                  res.on('data', chunk => chunks.push(chunk));
                  res.on('end', () => {
                    clearTimeout(timeout);
                    resolve({
                      status: res.statusCode,
                      text: Buffer.concat(chunks).toString('utf8'),
                    });
                  });
                },
              );
              req.on('error', err => {
                clearTimeout(timeout);
                reject(err);
              });
              req.end(body);
            },
          );

          expect(statusAndBody.status).toBe(200);
          expect(statusAndBody.text).toBe(String(body.length));
        },
      );

      // Covers Node keep-alive drain and uWS lazy onData drain (same early-response path).
      skipIf(
        skipNativeRuntimes ||
          serverImplName === 'Bun' ||
          serverImplName === 'Deno' ||
          serverImplName === 'hapi',
      )('keeps the connection reusable after early response without reading the body', async () => {
        const adapter = createServerAdapter(() => new fetchAPI.Response('nope', { status: 413 }));
        await testServer.addOnceHandler(adapter);

        const url = new URL(testServer.url);
        // https keep-alive needs https.Agent; skip reuse assertion there and still check status.
        const agent =
          url.protocol === 'http:' ? new http.Agent({ keepAlive: true, maxSockets: 1 }) : undefined;
        const body = Buffer.alloc(100_000, 'b');

        function post(id: number) {
          return new Promise<{ id: number; status: number | undefined; reusedSocket: boolean }>(
            (resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error(`request ${id} hung`)), 3000);
              const req = requestForUrl(
                url,
                {
                  path: url.pathname + url.search,
                  method: 'POST',
                  agent,
                  headers: {
                    'content-length': body.length,
                    'content-type': 'application/octet-stream',
                    connection: 'keep-alive',
                  },
                },
                res => {
                  res.resume();
                  res.on('end', () => {
                    clearTimeout(timeout);
                    resolve({
                      id,
                      status: res.statusCode,
                      reusedSocket: Boolean(req.reusedSocket),
                    });
                  });
                },
              );
              req.on('error', err => {
                clearTimeout(timeout);
                reject(err);
              });
              req.end(body);
            },
          );
        }

        try {
          const first = await post(1);
          expect(first.status).toBe(413);

          await testServer.addOnceHandler(adapter);
          const second = await post(2);
          expect(second.status).toBe(413);
          // Only assert socket reuse on adapters we know keep the socket open.
          if (
            agent &&
            (serverImplName === 'node:http' ||
              serverImplName === 'express' ||
              serverImplName === 'uWebSockets')
          ) {
            expect(first.reusedSocket).toBe(false);
            expect(second.reusedSocket).toBe(true);
          }
        } finally {
          agent?.destroy();
        }
      });
    });
  });
});
