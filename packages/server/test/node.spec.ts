import { IncomingMessage, ServerResponse } from 'http';
import { HttpResponse } from 'uWebSockets.js';
import { fetch, ReadableStream, Response, URL } from '@whatwg-node/fetch';
import { createServerAdapter } from '@whatwg-node/server';
import { runTestsForEachFetchImpl } from './test-fetch.js';
import { runTestsForEachServerImpl } from './test-server.js';

describe('Node Specific Cases', () => {
  runTestsForEachFetchImpl(() => {
    runTestsForEachServerImpl(testServer => {
      it('should handle empty responses', async () => {
        const serverAdapter = createServerAdapter(() => {
          return undefined as any;
        });
        testServer.addOnceHandler(serverAdapter);
        const response = await fetch(testServer.url);
        await response.text();
        expect(response.status).toBe(404);
      });

      it('should handle waitUntil properly', async () => {
        let flag = false;
        const serverAdapter = createServerAdapter((_request, { waitUntil }: any) => {
          waitUntil(
            sleep(100).then(() => {
              flag = true;
            }),
          );
          return new Response(null, {
            status: 204,
          });
        });
        testServer.addOnceHandler(serverAdapter);
        const response$ = fetch(testServer.url);
        const response = await response$;
        await response.text();
        expect(flag).toBe(false);
        await sleep(100);
        expect(flag).toBe(true);
      });

      it('should forward additional context', async () => {
        const handleRequest = jest.fn().mockImplementation(() => {
          return new Response(null, {
            status: 204,
          });
        });
        const serverAdapter = createServerAdapter<{
          req: IncomingMessage;
          res: ServerResponse;
          foo: string;
        }>(handleRequest);
        const additionalCtx = { foo: 'bar' };
        testServer.addOnceHandler((...args: any[]) =>
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
        const cancelFn = jest.fn();
        const serverAdapter = createServerAdapter(
          () =>
            new Response(
              new ReadableStream({
                async pull(controller) {
                  await sleep(100);
                  controller.enqueue(Date.now().toString());
                },
                cancel: cancelFn,
              }),
            ),
        );
        testServer.addOnceHandler(serverAdapter);
        const response = await fetch(testServer.url);

        const collectedValues: string[] = [];

        let i = 0;
        for await (const chunk of response.body as any as AsyncIterable<Uint8Array>) {
          if (i > 2) {
            break;
          }
          collectedValues.push(Buffer.from(chunk).toString('utf-8'));
          i++;
        }

        expect(collectedValues).toHaveLength(3);
        await sleep(100);
        expect(cancelFn).toHaveBeenCalledTimes(1);
      });

      it('should not kill the server if response is ended on low level', async () => {
        const serverAdapter = createServerAdapter<{
          res: HttpResponse | ServerResponse;
        }>((_req, { res }) => {
          res.end('This should reach the client.');
          return new Response('This should never reach the client.', {
            status: 200,
          });
        });
        testServer.addOnceHandler(serverAdapter);
        const response = await fetch(testServer.url);
        const resText = await response.text();
        expect(resText).toBe('This should reach the client.');
      });

      it('should handle sync errors', async () => {
        const serverAdapter = createServerAdapter(() => {
          throw new Error('This is an error.');
        });
        testServer.addOnceHandler(serverAdapter);
        const response = await fetch(testServer.url);
        expect(response.status).toBe(500);
        expect(await response.text()).toContain('This is an error.');
      });

      it('should handle async errors', async () => {
        const serverAdapter = createServerAdapter(async () => {
          throw new Error('This is an error.');
        });
        testServer.addOnceHandler(serverAdapter);
        const response = await fetch(testServer.url);
        expect(response.status).toBe(500);
        expect(await response.text()).toContain('This is an error.');
      });

      it('should handle async body read streams', async () => {
        const serverAdapter = createServerAdapter(async request => {
          await new Promise(resolve => setTimeout(resolve, 10));
          const reqText = await request.text();
          return new Response(reqText, { status: 200 });
        });
        testServer.addOnceHandler(serverAdapter);
        const response = await fetch(testServer.url, {
          method: 'POST',
          body: 'Hello World',
        });
        expect(response.status).toBe(200);
        expect(await response.text()).toContain('Hello World');
      });

      it('should respect the status code', async () => {
        const serverAdapter = createServerAdapter(() => {
          const error = new Error('This is an error.');
          (error as any).status = 418;
          throw error;
        });
        testServer.addOnceHandler(serverAdapter);
        const response = await fetch(testServer.url);
        await response.text();
        expect(response.status).toBe(418);
      });

      it('handles AbortSignal correctly', async () => {
        const abortListener = jest.fn();
        const serverAdapter = createServerAdapter(
          req =>
            new Promise(resolve => {
              req.signal.onabort = () => {
                abortListener();
                resolve(new Response('Hello World', { status: 200 }));
              };
            }),
        );
        testServer.addOnceHandler(serverAdapter);
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 1000);
        const error = await fetch(testServer.url, { signal: controller.signal }).catch(e => e);
        expect(error.toString().toLowerCase()).toContain('abort');
        await new Promise(resolve => setTimeout(resolve, 300));
        expect(abortListener).toHaveBeenCalledTimes(1);
      });

      it('handles query parameters correctly', async () => {
        const serverAdapter = createServerAdapter(req => {
          const urlObj = new URL(req.url);
          return new Response(urlObj.search, { status: 200 });
        });
        testServer.addOnceHandler(serverAdapter);
        const response = await fetch(`${testServer.url}?foo=bar`);
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('?foo=bar');
      });

      it('sends content-length correctly', async () => {
        const serverAdapter = createServerAdapter(req => {
          return Response.json({
            contentLength: req.headers.get('content-length'),
          });
        });
        testServer.addOnceHandler(serverAdapter);
        const response = await fetch(testServer.url, {
          method: 'POST',
          body: 'Hello World',
        });
        const resJson = await response.json();
        expect(resJson.contentLength).toBe('11');
      });
    });
  });
});

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
