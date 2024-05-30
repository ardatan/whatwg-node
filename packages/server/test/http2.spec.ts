import {
  ClientHttp2Session,
  connect as connectHttp2,
  constants as constantsHttp2,
  createServer,
  Http2Server,
} from 'http2';
import { AddressInfo } from 'net';
import { runTestsForEachFetchImpl } from './test-fetch';

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

  runTestsForEachFetchImpl((_, { createServerAdapter }) => {
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

      const receivedNodeRequest = await new Promise<{
        headers: Record<string, string | string[] | undefined>;
        data: string;
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
                data,
              });
            });
          },
        );
        req.once('error', reject);
      });

      expect(receivedNodeRequest).toMatchObject({
        data: 'Hey there!',
        headers: {
          ':status': 418,
          'content-type': 'text/plain;charset=UTF-8',
          'x-is-this-http2': 'yes',
        },
      });

      await new Promise<void>(resolve => req.end(resolve));

      const calledRequest = handleRequest.mock.calls[0][0];

      expect(calledRequest.method).toBe('POST');
      expect(calledRequest.url).toMatch(/^http:\/\/localhost:\d+\/hi$/);
    });
  });
});
