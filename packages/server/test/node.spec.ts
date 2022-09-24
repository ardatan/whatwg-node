import { createServerAdapter } from '@whatwg-node/server';
import { fetch, Response } from '@whatwg-node/fetch';
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
    expect(handleRequest).toHaveBeenCalledWith(expect.any(Request), expect.objectContaining(additionalCtx));
  });
});

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
