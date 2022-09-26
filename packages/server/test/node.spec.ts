import { createServerAdapter } from '@whatwg-node/server';
import { fetch, Response, ReadableStream } from '@whatwg-node/fetch';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';

describe('Node Specific Cases', () => {
  let server: Server;
  let url: string;
  beforeEach(done => {
    server = createServer();
    server.listen(0, () => {
      url = `http://localhost:${(server.address() as AddressInfo).port}`;
      done();
    });
  });

  afterEach(done => {
    server.close(done);
  });
  it('should handle empty responses', async () => {
    const serverAdapter = createServerAdapter(() => {
      return undefined as any;
    });
    server.on('request', serverAdapter);
    const response = await fetch(url);
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
    server.on('request', serverAdapter);
    const response$ = fetch(url);
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
    server.on('request', (...args) => serverAdapter(...args, additionalCtx));
    const response = await fetch(url);
    await response.text();
    expect(handleRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(additionalCtx));
  });

  it('should handle cancellation of incremental responses', async () => {
    const cancelFn = jest.fn();
    const serverAdapter = createServerAdapter(() => new Response(
      new ReadableStream({
        async pull(controller) {
          await sleep(100);
          controller.enqueue(Date.now().toString());
        },
        cancel: cancelFn,
      })
    ));
    server.on('request', serverAdapter);
    const abortCtrl = new AbortController();
    const response = await fetch(url, {
      signal: abortCtrl.signal,
    });
    const reader = response.body!.getReader();

    const collectedValues: string[] = [];
    let i = 0;
    while (true) {
      if (i > 2) {
        reader.releaseLock();
        break;
      }
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      const str = Buffer.from(value!).toString('utf-8');
      collectedValues.push(str);
      i++;
    }

    abortCtrl.abort();

    expect(collectedValues).toHaveLength(3);
    await sleep(100);
    expect(cancelFn).toHaveBeenCalled();

  })
});

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
