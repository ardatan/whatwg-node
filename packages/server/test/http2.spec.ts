import {
  ClientHttp2Session,
  connect as connectHttp2,
  constants as constantsHttp2,
  createServer,
  Http2Server,
} from 'node:http2';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { runTestsForEachFetchImpl } from './test-fetch';

const describeIf = (condition: boolean) => (condition ? describe : describe.skip);

// HTTP2 is not supported fully on Bun and Deno
describeIf(!globalThis.Bun && !globalThis.Deno)('http2', () => {
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

  runTestsForEachFetchImpl((_, { createServerAdapter }) => {
    it('should support http2 and respond as expected', async () => {
      const handleRequest = jest.fn(async (request: Request) => {
        return Response.json(
          {
            body: await request.json(),
            headers: Object.fromEntries(request.headers),
            method: request.method,
            url: request.url,
          },
          {
            headers: {
              'x-is-this-http2': 'yes',
              'content-type': 'text/plain;charset=UTF-8',
            },
            status: 418,
          },
        );
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
        [constantsHttp2.HTTP2_HEADER_CONTENT_TYPE]: 'application/json',
      });

      req.write(JSON.stringify({ hello: 'world' }));
      req.end();

      const receivedNodeRequest = await new Promise<{
        headers: Record<string, string | string[] | undefined>;
        data: string;
        status?: number | undefined;
      }>((resolve, reject) => {
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
                data: JSON.parse(data),
                status: headers[':status'],
              });
            });
          },
        );
        req.once('error', reject);
      });

      expect(receivedNodeRequest).toMatchObject({
        data: {
          body: {
            hello: 'world',
          },
          method: 'POST',
          url: expect.stringMatching(/^http:\/\/localhost:\d+\/hi$/),
          headers: {
            'content-type': 'application/json',
          },
        },
        headers: {
          ':status': 418,
          'content-type': 'text/plain;charset=UTF-8',
          'x-is-this-http2': 'yes',
        },
        status: 418,
      });

      await new Promise<void>(resolve => req.end(resolve));
    });
  });
});
