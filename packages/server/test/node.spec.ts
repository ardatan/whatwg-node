import { IncomingMessage, ServerResponse } from 'http';
import {
  ClientHttp2Session,
  connect as connectHttp2,
  constants as constantsHttp2,
  createServer,
  Http2Server,
  Http2ServerRequest,
  Http2ServerResponse,
} from 'http2';
import { AddressInfo } from 'net';
import { HttpResponse } from 'uWebSockets.js';
import { fetch, ReadableStream, Response, URL } from '@whatwg-node/fetch';
import { createServerAdapter } from '@whatwg-node/server';
import { runTestsForEachServerImpl } from './test-server.js';

describe('Node Specific Cases', () => {
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
      testServer.addOnceHandler((...args: any[]) => (serverAdapter as any)(...args, additionalCtx));
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

    it('should respect the status code', async () => {
      const serverAdapter = createServerAdapter(() => {
        const error = new Error('This is an error.');
        (error as any).status = 418;
        throw error;
      });
      testServer.addOnceHandler(serverAdapter);
      const response = await fetch(testServer.url);
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
  });
});

describe('http2', () => {
  let server: Http2Server;
  let client: ClientHttp2Session;

  afterEach(async () => {
    if (client) {
      await new Promise<void>(resolve => client.close(resolve));
    }
    if (server) {
      await new Promise<any>(resolve => server.close(resolve));
    }
  });

  // ts-only-test
  it.skip('should have compatible types for http2', () => {
    const adapter = createServerAdapter(() => {
      return null as any;
    });

    const req = null as unknown as Http2ServerRequest;
    const res = null as unknown as Http2ServerResponse;

    adapter.handleNodeRequest(req);
    adapter.handle(req, res);
    adapter(req, res);
  });

  it('should support http2 and respond as expected', async () => {
    const handleRequest: jest.Mock<Response, [Request]> = jest
      .fn()
      .mockImplementation((_request: Request) => {
        return new Response('Hey there!', {
          status: 418,
          headers: { 'x-is-this-http2': 'yes', 'content-type': 'text/plain;charset=UTF-8' },
        });
      });
    const adapter = createServerAdapter(handleRequest);

    server = createServer(adapter);
    await new Promise<void>(resolve => server.listen(0, resolve));

    const port = (server.address() as AddressInfo).port;

    // Node's fetch API does not support HTTP/2, we use the http2 module directly instead

    client = connectHttp2(`http://localhost:${port}`);

    const req = client.request({
      [constantsHttp2.HTTP2_HEADER_METHOD]: 'POST',
      [constantsHttp2.HTTP2_HEADER_PATH]: '/hi',
    });

    const receivedNodeRequest = await new Promise((resolve, reject) => {
      req.once(
        'response',
        ({
          date, // omit date from snapshot
          ...headers
        }) => {
          let data = '';
          req.on('data', chunk => {
            data += chunk;
          });
          req.on('end', () => {
            resolve({
              headers,
              data,
            });
          });
        },
      );
      req.once('error', reject);
    });

    expect(receivedNodeRequest).toMatchInlineSnapshot(`
      {
        "data": "Hey there!",
        "headers": {
          ":status": 418,
          "content-length": "10",
          "content-type": "text/plain;charset=UTF-8",
          "x-is-this-http2": "yes",
          Symbol(nodejs.http2.sensitiveHeaders): [],
        },
      }
    `);

    await new Promise<void>(resolve => req.end(resolve));

    const calledRequest = handleRequest.mock.calls[0][0];

    expect(calledRequest.method).toBe('POST');
    expect(calledRequest.url).toMatch(/^http:\/\/localhost:\d+\/hi$/);
  });
});

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
