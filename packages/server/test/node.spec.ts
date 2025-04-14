import { Buffer } from 'node:buffer';
import { IncomingMessage, ServerResponse, STATUS_CODES } from 'node:http';
import { setTimeout } from 'node:timers/promises';
import React from 'react';
// @ts-expect-error Types are not available yet
import { renderToReadableStream } from 'react-dom/server.edge';
import { HttpResponse } from 'uWebSockets.js';
import Hapi from '@hapi/hapi';
import { describe, expect, it, jest } from '@jest/globals';
import { DisposableSymbols } from '@whatwg-node/disposablestack';
import { createDeferredPromise } from '@whatwg-node/server';
import { runTestsForEachFetchImpl } from './test-fetch.js';
import { runTestsForEachServerImpl } from './test-server.js';

describe('Node Specific Cases', () => {
  runTestsForEachFetchImpl(
    (
      _fetchImplName,
      { createServerAdapter, fetchAPI: { fetch, ReadableStream, Response, URL } },
    ) => {
      runTestsForEachServerImpl((testServer, serverImplName) => {
        // Deno and Bun does not empty responses
        if (!globalThis.Bun && !globalThis.Deno) {
          it('should handle empty responses', async () => {
            await using serverAdapter = createServerAdapter(() => {
              return undefined as any;
            });
            await testServer.addOnceHandler(serverAdapter);
            const response = await fetch(testServer.url);
            await response.text();
            expect(response.status).toBe(404);
          });
        }

        it('should handle waitUntil properly', async () => {
          const backgroundJob$ = createDeferredPromise<void>();
          backgroundJob$.promise.finally(() => {
            backgroundJobDone = true;
          });
          let backgroundJobDone = false;
          const callOrder: string[] = [];
          await using serverAdapter = createServerAdapter((_request, { waitUntil }) => {
            waitUntil(backgroundJob$.promise);
            waitUntil(
              setTimeout(100).then(() => {
                callOrder.push('waitUntil');
              }),
            );
            callOrder.push('response');
            return new Response('OK', {
              status: 200,
            });
          });
          await testServer.addOnceHandler(serverAdapter);
          const response$ = fetch(testServer.url);
          const response = await response$;
          await response.text();
          await setTimeout(300);
          expect(callOrder).toEqual(['response', 'waitUntil']);
          const dispose$ = Promise.resolve(serverAdapter.dispose());
          let disposeDone = false;
          dispose$.then(() => {
            disposeDone = true;
          });
          expect(backgroundJobDone).toBe(false);
          expect(disposeDone).toBe(false);
          backgroundJob$.resolve();
          await dispose$;
          expect(backgroundJobDone).toBe(true);
          expect(disposeDone).toBe(true);
        });

        it('should forward additional context', async () => {
          let calledRequest: Request | undefined;
          let calledCtx: Record<string, any> | undefined;
          const handleRequest = jest.fn((_req: Request, _ctx: any) => {
            calledRequest = _req;
            calledCtx = _ctx;
            return new Response('OK', {
              status: 200,
            });
          });
          await using serverAdapter = createServerAdapter<{
            req: IncomingMessage;
            res: ServerResponse;
            foo: string;
          }>(handleRequest);
          const additionalCtx = { foo: 'bar' };
          await testServer.addOnceHandler(serverAdapter, additionalCtx);
          const response = await fetch(testServer.url);
          await response.text();
          expect(calledRequest).toBeDefined();
          expect(calledCtx).toBeDefined();
          expect(calledCtx).toMatchObject(additionalCtx);
        });

        const skipIf = (condition: boolean) => (condition ? it.skip : it);
        skipIf(
          (globalThis.Bun && serverImplName !== 'Bun') ||
            (globalThis.Deno && serverImplName !== 'Deno'),
        )(
          'should handle cancellation of incremental responses',
          async () => {
            const deferred = createDeferredPromise<void>();
            let cancellation = 0;
            await using serverAdapter = createServerAdapter(() => {
              return new Response(
                new ReadableStream({
                  async pull(controller) {
                    await setTimeout(100);
                    controller.enqueue(Buffer.from(Date.now().toString()));
                  },
                  cancel() {
                    cancellation++;
                    deferred.resolve();
                  },
                }),
              );
            });
            await testServer.addOnceHandler(serverAdapter);
            const ctrl = new AbortController();
            const response = await fetch(testServer.url, {
              signal: ctrl.signal,
            });

            const collectedValues: string[] = [];

            let i = 0;
            const reader = response.body!.getReader();
            reader.closed.catch(() => {});
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
              if (i > 2) {
                ctrl.abort();
                break;
              }
              if (value) {
                collectedValues.push(Buffer.from(value).toString('utf-8'));
                i++;
              }
            }
            expect(collectedValues).toHaveLength(3);
            await deferred.promise;
            expect(cancellation).toBe(1);
          },
          1000,
        );
        it('should handle large streaming responses', async () => {
          const successFn = jest.fn();
          await using serverAdapter = createServerAdapter(() => {
            let i = 0;
            const t = 5;
            const stream = new ReadableStream({
              pull(controller) {
                i++;
                if (i > t) {
                  controller.close();
                } else {
                  successFn();
                  controller.enqueue(Buffer.from('x'.repeat(5409)));
                }
              },
            });
            return new Response(stream, { status: 200 });
          });
          await testServer.addOnceHandler(serverAdapter);
          const response = await fetch(testServer.url);

          let result: string | null = '';
          for await (const chunk of response.body as any as AsyncIterable<Uint8Array>) {
            result += Buffer.from(chunk).toString('utf-8');
          }

          expect(result.length).toBe(27045);
          expect(successFn).toHaveBeenCalledTimes(5);

          result = null;
        });

        if (!globalThis.Bun && !globalThis.Deno) {
          it('should not kill the server if response is ended on low level', async () => {
            await using serverAdapter = createServerAdapter<{
              res: HttpResponse | ServerResponse;
              h: Hapi.ResponseToolkit;
            }>((_req, { res }) => {
              res.end('This should reach the client.');
              return new Response('This should never reach the client.', {
                status: 200,
              });
            });
            await testServer.addOnceHandler(serverAdapter);
            const response = await fetch(testServer.url);
            const resText = await response.text();
            expect(resText).toBe('This should reach the client.');
          });

          it('should handle sync errors', async () => {
            await using serverAdapter = createServerAdapter(() => {
              throw new Error('This is an error.');
            });
            await testServer.addOnceHandler(serverAdapter);
            const response = await fetch(testServer.url);
            expect(response.status).toBe(500);
            expect(await response.text()).toContain('This is an error.');
          });

          it('should handle async errors', async () => {
            await using serverAdapter = createServerAdapter(async () => {
              throw new Error('This is an error.');
            });
            await testServer.addOnceHandler(serverAdapter);
            const response = await fetch(testServer.url);
            expect(response.status).toBe(500);
            expect(await response.text()).toContain('This is an error.');
          });
        }

        it('should handle async body read streams', async () => {
          await using serverAdapter = createServerAdapter(async request => {
            await setTimeout(10);
            const reqText = await request.text();
            return new Response(reqText, { status: 200 });
          });
          await testServer.addOnceHandler(serverAdapter);
          const response = await fetch(testServer.url, {
            method: 'POST',
            body: 'Hello World',
          });
          expect(await response.text()).toContain('Hello World');
          expect(response.status).toBe(200);
        });

        skipIf(
          (globalThis.Bun && serverImplName !== 'Bun') ||
            (globalThis.Deno && serverImplName !== 'Deno'),
        )('handles Request.signal inside adapter correctly', async () => {
          const abortListener = jest.fn();
          const abortDeferred = createDeferredPromise<void>();
          const adapterResponseDeferred = createDeferredPromise<Response>();
          function resolveAdapter() {
            adapterResponseDeferred.resolve(
              Response.json({
                message: "You're so late!",
              }),
            );
          }
          await using serverAdapter = createServerAdapter(req => {
            req.signal.addEventListener('abort', () => {
              abortListener();
              abortDeferred.resolve();
            });
            return adapterResponseDeferred.promise;
          });
          await testServer.addOnceHandler(serverAdapter);
          const controller = new AbortController();
          const response$ = fetch(testServer.url, { signal: controller.signal });
          expect(abortListener).toHaveBeenCalledTimes(0);
          globalThis.setTimeout(() => {
            controller.abort();
          }, 300);
          await expect(response$).rejects.toThrow();
          await abortDeferred.promise;
          expect(abortListener).toHaveBeenCalledTimes(1);
          resolveAdapter();
        });

        skipIf(
          (globalThis.Bun && serverImplName !== 'Bun') ||
            (globalThis.Deno && serverImplName !== 'Deno'),
        )('handles Request.signal inside adapter with streaming bodies', async () => {
          const abortDeferred = createDeferredPromise<void>();
          const adapterResponseDeferred = createDeferredPromise<Response>();
          function resolveAdapter() {
            adapterResponseDeferred.resolve(
              Response.json({
                message: "You're so late!",
              }),
            );
          }
          const controller = new AbortController();
          await using serverAdapter = createServerAdapter(req => {
            req.signal.addEventListener('abort', () => {
              abortDeferred.resolve();
            });
            return req.text().then(() => {
              controller.abort();
              return adapterResponseDeferred.promise;
            });
          });
          await testServer.addOnceHandler(serverAdapter);
          let error: Error | undefined;
          try {
            await fetch(testServer.url, {
              method: 'POST',
              signal: controller.signal,
              body: 'Hello world!',
            });
          } catch (e: any) {
            error = e;
          }
          expect(error).toBeDefined();
          await setTimeout(100);
          await abortDeferred.promise;
          resolveAdapter();
        });

        it('handles query parameters correctly', async () => {
          await using serverAdapter = createServerAdapter(req => {
            const urlObj = new URL(req.url);
            return new Response(urlObj.search, { status: 200 });
          });
          await testServer.addOnceHandler(serverAdapter);
          const response = await fetch(`${testServer.url}?foo=bar`);
          expect(response.status).toBe(200);
          expect(await response.text()).toBe('?foo=bar');
        });

        it('sends content-length correctly', async () => {
          await using serverAdapter = createServerAdapter(req => {
            return Response.json({
              contentLength: req.headers.get('content-length'),
            });
          });
          await testServer.addOnceHandler(serverAdapter);
          const response = await fetch(testServer.url, {
            method: 'POST',
            body: 'Hello World',
          });
          const resJson = await response.json();
          expect(resJson.contentLength).toBe('11');
        });

        it('sends content-length correctly if body is nullish', async () => {
          await using serverAdapter = createServerAdapter(req => {
            return Response.json({
              contentLength: req.headers.get('content-length'),
            });
          });
          await testServer.addOnceHandler(serverAdapter);
          const response = await fetch(testServer.url, {
            method: 'POST',
          });

          const resJson = await response.json();
          expect(resJson.contentLength).toBe('0');
        });

        it('sends content-length correctly if body is empty', async () => {
          await using serverAdapter = createServerAdapter(req => {
            return Response.json({
              contentLength: req.headers.get('content-length'),
            });
          });
          await testServer.addOnceHandler(serverAdapter);
          const response = await fetch(testServer.url, {
            method: 'POST',
            body: '',
          });

          const resJson = await response.json();
          expect(resJson.contentLength).toBe('0');
        });

        it('clones the request correctly', async () => {
          await using serverAdapter = createServerAdapter(async req => {
            const clonedReq = req.clone();
            const textFromClonedReq = await req.text();
            const textFromOriginalReq = await clonedReq.text();
            return Response.json({
              textFromClonedReq,
              textFromOriginalReq,
            });
          });
          await testServer.addOnceHandler(serverAdapter);
          const response = await fetch(testServer.url, {
            method: 'POST',
            body: 'TEST',
          });
          const resJson = await response.json();
          expect(resJson.textFromClonedReq).toBe('TEST');
          expect(resJson.textFromOriginalReq).toBe('TEST');
        });

        it('waits for the sent promises to waitUntil', async () => {
          const deferred = createDeferredPromise<void>();
          await using serverAdapter = createServerAdapter((_req, ctx) => {
            ctx.waitUntil(deferred.promise);
            return Response.json({ message: 'Hello World' });
          });
          await testServer.addOnceHandler(serverAdapter);
          const response = await fetch(testServer.url);
          const responseJson = await response.json();
          expect(responseJson).toEqual({ message: 'Hello World' });
          const disposedThen = jest.fn();
          serverAdapter[DisposableSymbols.asyncDispose]().then(disposedThen);
          expect(disposedThen).not.toHaveBeenCalled();
          deferred.resolve();
          await setTimeout(100);
          expect(disposedThen).toHaveBeenCalled();
        });

        skipIf(globalThis.Deno && serverImplName !== 'Deno')(
          'handles ipv6 addresses correctly',
          async () => {
            await using serverAdapter = createServerAdapter(() => {
              return new Response('Hello world!', { status: 200 });
            });
            await testServer.addOnceHandler(serverAdapter);
            const port = new URL(testServer.url).port;
            const ipv6Url = new URL(`http://[::1]:${port}/`);
            const response = await fetch(ipv6Url);
            expect(response.status).toBe(200);
            await expect(response.text()).resolves.toBe('Hello world!');
          },
        );

        describe('handles status codes correctly', () => {
          for (const statusCodeStr in STATUS_CODES) {
            const status = Number(statusCodeStr);
            if (Number.isNaN(status)) {
              continue;
            }
            if (status < 200) {
              // Informational responses are not supported by fetch in this way
              continue;
            }
            if (status === 421) {
              // 421 Misdirected Request is not supported by fetch in this way
              continue;
            }
            if (status === 407) {
              // 407 Proxy Authentication Required is not supported by fetch in this way
              continue;
            }
            if (status === 509) {
              // 509 Bandwidth Limit Exceeded is not supported by fetch in this way
              continue;
            }
            const withBody = status !== 204 && status !== 205 && status !== 304;
            // With status code 205, Koa hangs without a body on Node 18
            if (
              process.versions.node.startsWith('18.') &&
              serverImplName === 'koa' &&
              status === 205
            ) {
              continue;
            }
            it(
              status.toString(),
              async () => {
                await using serverAdapter = createServerAdapter(
                  () =>
                    new Response(withBody ? 'OK' : null, {
                      status,
                      statusText: STATUS_CODES[status] as string,
                    }),
                );
                await testServer.addOnceHandler(serverAdapter);
                const ctrl = new AbortController();
                let resText: string | null = null;
                const res = await fetch(testServer.url, {
                  signal: ctrl.signal,
                });
                resText = await res.text();
                if (res.status !== status && res.status === 500) {
                  throw new Error(
                    `Unexpected status ${res.status} for status ${status}; ${resText}`,
                  );
                }
                expect(status.toString()).toBe(res.status.toString());
                let expectedStatusText: any = STATUS_CODES[status];
                if (res.statusText && expectedStatusText) {
                  // Status text for 425 Too Early is not consistent in Koa
                  if (status === 425 && serverImplName === 'koa') {
                    return;
                  }
                  expectedStatusText = STATUS_CODES[status]
                    ?.toLowerCase()
                    ?.split('-')
                    ?.join('')
                    ?.split(' ')
                    ?.join('');
                  const statusText = res.statusText
                    ?.toLowerCase()
                    ?.split('-')
                    ?.join('')
                    ?.split(' ')
                    ?.join('');
                  if (res.status === 413) {
                    expect(statusText).toContain('toolarge');
                    return;
                  }
                  if (
                    statusText.includes(expectedStatusText) ||
                    expectedStatusText.includes(statusText)
                  ) {
                  } else {
                    throw new Error(
                      `Expected status text to be ${expectedStatusText}, got ${statusText}`,
                    );
                  }
                }
              },
              1000,
            );
          }
        });

        it('handles headers and status', async () => {
          await using adapter = createServerAdapter(async req => {
            const data = await req.json();
            return new Response('OK', {
              headers: data.headers || {
                'x-foo': 'foo',
                'x-bar': 'bar',
              },
            });
          });
          await testServer.addOnceHandler(adapter);
          const res = await fetch(testServer.url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({ headers: { 'x-foo': 'foo', 'x-bar': 'bar' } }),
          });
          expect(res.headers.get('x-foo')).toBe('foo');
          expect(res.headers.get('x-bar')).toBe('bar');
          await res.text();
        });

        it('handles GET requests with query params', async () => {
          await using serverAdapter = createServerAdapter((request: Request) => {
            const url = new URL(request.url);
            const searchParamsObj = Object.fromEntries(url.searchParams);
            return Response.json(searchParamsObj);
          });
          await testServer.addOnceHandler(serverAdapter);
          const res = await fetch(testServer.url + '?foo=bar&baz=qux');
          const body = await res.json();
          expect(body).toMatchObject({
            foo: 'bar',
            baz: 'qux',
          });
        });

        it('handles react streaming response', async () => {
          await using serverAdapter = createServerAdapter(async () => {
            const MyComponent = () => {
              return React.createElement('h1', null, 'Rendered in React');
            };

            const stream = await renderToReadableStream(React.createElement(MyComponent));

            return new Response(stream);
          });
          await testServer.addOnceHandler(serverAdapter);
          const res = await fetch(testServer.url);
          const body = await res.text();
          expect(body).toEqual('<h1>Rendered in React</h1>');
        });
      });
    },
  );
});
