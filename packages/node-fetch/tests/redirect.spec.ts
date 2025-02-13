import { createServer, IncomingMessage, RequestListener, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { runTestsForEachFetchImpl } from '../../server/test/test-fetch';

describe('Redirections', () => {
  runTestsForEachFetchImpl((_, { fetchAPI }) => {
    const redirectionStatusCodes = [301, 302, 303, 307, 308];
    const nonRedirectionLocationStatusCodes = [200, 201, 204];
    let requestListener: RequestListener;
    let server: Server;
    let addressInfo: AddressInfo;
    beforeEach(() => {
      requestListener = jest.fn((req: IncomingMessage, res: ServerResponse) => {
        if (req.url?.startsWith('/status-')) {
          const [_, statusCode] = req.url.split('-');
          res.writeHead(Number(statusCode), {
            Location: '/redirected',
          });
          res.end();
        } else if (req.url === '/redirected') {
          res.writeHead(200);
          res.end('redirected');
        }
      });
      return new Promise<void>(resolve => {
        server = createServer(requestListener).listen(0, () => {
          addressInfo = server.address() as AddressInfo;
          resolve();
        });
      });
    });
    afterEach(done => {
      server.close(done);
    });
    for (const statusCode of redirectionStatusCodes) {
      it(`should follow ${statusCode} redirection`, async () => {
        const res = await fetchAPI.fetch(
          `http://localhost:${addressInfo.port}/status-${statusCode}`,
        );
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('redirected');
        expect(requestListener).toHaveBeenCalledTimes(2);
      });
    }
    for (const statusCode of nonRedirectionLocationStatusCodes) {
      it(`should not follow ${statusCode} redirection with Location header`, async () => {
        const res = await fetchAPI.fetch(
          `http://localhost:${addressInfo.port}/status-${statusCode}`,
        );
        expect(res.status).toBe(statusCode);
        expect(res.headers.get('Location')).toBe('/redirected');
        expect(await res.text()).toBe('');
        expect(requestListener).toHaveBeenCalledTimes(1);
      });
    }
  });
});
