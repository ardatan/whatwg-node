import { createServerAdapter } from '@whatwg-node/server';
import { fetch, Response, ReadableStream } from '@whatwg-node/fetch';
import { IncomingMessage, ServerResponse } from 'http';
import { createTestServer, TestServer } from './test-server';

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
    });
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
    });
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
    }>(handleRequest);
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
        )
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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
