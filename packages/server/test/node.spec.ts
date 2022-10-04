import { createServerAdapter } from '@whatwg-node/server';
import { IncomingMessage, ServerResponse } from 'http';
import { createTestServer, TestServer } from './test-server';
import {
  createServer,
  Http2ServerRequest,
  Http2ServerResponse,
  connect as connectHttp2,
  constants as constantsHttp2,
  Http2Server,
  ClientHttp2Session,
} from 'http2';
import { AddressInfo } from 'net';
import { Request, Response, ReadableStream, fetch } from '@whatwg-node/fetch';

describe('Node Specific Cases', () => {
  let testServer: TestServer;
  beforeAll(async () => {
    testServer = await createTestServer();
  });

  afterAll(done => {
    testServer.server.close(done);
  });

  it('should handle empty responses', async () => {
    const serverAdapter = createServerAdapter(() => {
      return undefined as any;
    }, Request);
    testServer.server.once('request', serverAdapter);
    const response = await fetch(testServer.url);
    await response.text();
    expect(response.status).toBe(404);
  });

  it('should handle waitUntil properly', async () => {
    let flag = false;
    const serverAdapter = createServerAdapter((_request, { waitUntil }) => {
      waitUntil(
        sleep(100).then(() => {
          flag = true;
        })
      );
      return new Response(null, {
        status: 204,
      });
    }, Request);
    testServer.server.once('request', serverAdapter);
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
    }>(handleRequest, Request);
    const additionalCtx = { foo: 'bar' };
    testServer.server.once('request', (...args) => serverAdapter(...args, additionalCtx));
    const response = await fetch(testServer.url);
    await response.text();
    expect(handleRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(additionalCtx));
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
          })
        ),
      Request
    );

    testServer.server.once('request', serverAdapter);
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
    const handleRequest: jest.Mock<Response, [Request]> = jest.fn().mockImplementation((_request: Request) => {
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
        }
      );
      req.once('error', reject);
    });

    expect(receivedNodeRequest).toMatchInlineSnapshot(`
      {
        "data": "Hey there!",
        "headers": {
          ":status": 418,
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
