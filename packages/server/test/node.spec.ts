import { IncomingMessage, ServerResponse } from 'http';
import { setTimeout } from 'timers/promises';
import { HttpResponse } from 'uWebSockets.js';
import { DisposableSymbols } from '@whatwg-node/disposablestack';
import { createDeferredPromise } from '@whatwg-node/server';
import { runTestsForEachFetchImpl } from './test-fetch.js';
import { runTestsForEachServerImpl } from './test-server.js';

describe('Node Specific Cases', () => {
  runTestsForEachFetchImpl(
    (
      fetchImplName,
      { createServerAdapter, fetchAPI: { fetch, ReadableStream, Response, URL } },
    ) => {
      runTestsForEachServerImpl(testServer => {
        if (!globalThis.Bun) {
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
          const callOrder: string[] = [];
          await using serverAdapter = createServerAdapter((_request, { waitUntil }: any) => {
            waitUntil(
              setTimeout(100).then(() => {
                callOrder.push('waitUntil');
              }),
            );
            callOrder.push('response');
            return new Response(null, {
              status: 204,
            });
          });
          await testServer.addOnceHandler(serverAdapter);
          const response$ = fetch(testServer.url);
          const response = await response$;
          await response.text();
          await setTimeout(300);
          expect(callOrder).toEqual(['response', 'waitUntil']);
        });

        it('should forward additional context', async () => {
          const handleRequest = jest.fn().mockImplementation(() => {
            return new Response(null, {
              status: 204,
            });
          });
          await using serverAdapter = createServerAdapter<{
            req: IncomingMessage;
            res: ServerResponse;
            foo: string;
          }>(handleRequest);
          const additionalCtx = { foo: 'bar' };
          await testServer.addOnceHandler((...args: any[]) =>
            (serverAdapter as any)(...args, additionalCtx),
          );
          const response = await fetch(testServer.url);
          await response.text();
          expect(handleRequest).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining(additionalCtx),
          );
        });

        it('should handle cancellation of incremental responses', async () => {
          const deferred = createDeferredPromise<void>();
          let cancellation = 0;
          await using serverAdapter = createServerAdapter(() => {
            return new Response(
              new ReadableStream({
                async pull(controller) {
                  await setTimeout(100);
                  controller.enqueue(Date.now().toString());
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
            collectedValues.push(Buffer.from(value!).toString('utf-8'));
            i++;
          }
          expect(collectedValues).toHaveLength(3);
          await deferred.promise;
          expect(cancellation).toBe(1);
        });
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
                  controller.enqueue('x'.repeat(5409));
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

        if (!globalThis.Bun) {
          it('should not kill the server if response is ended on low level', async () => {
            await using serverAdapter = createServerAdapter<{
              res: HttpResponse | ServerResponse;
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

          it('should respect the status code', async () => {
            await using serverAdapter = createServerAdapter(() => {
              const error = new Error('This is an error.');
              (error as any).status = 418;
              throw error;
            });
            await testServer.addOnceHandler(serverAdapter);
            const response = await fetch(testServer.url);
            await response.text();
            expect(response.status).toBe(418);
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
          expect(response.status).toBe(200);
          expect(await response.text()).toContain('Hello World');
        });

        // TODO: Flakey on native fetch
        if (!process.env.LEAK_TEST || fetchImplName.toLowerCase() !== 'native') {
          it.only('handles Request.signal inside adapter correctly', async () => {
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

          it('handles Request.signal inside adapter with streaming bodies', async () => {
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
        }

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
      });
    },
  );
});
