import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { runTestsForEachFetchImpl } from '../../server/test/test-fetch';

describe('Redirections', () => {
  // undici's redirect interceptor + many follow-up requests still intermittently
  // pins the Jest isolate under --detectLeaks; node-http covers this suite there.
  runTestsForEachFetchImpl(
    (_, { fetchAPI }) => {
      const redirectionStatusCodes = [301, 302, 303, 307, 308];
      const nonRedirectionLocationStatusCodes = [200, 201, 204];
      let requestCount = 0;
      let server: Server;
      let addressInfo: AddressInfo;
      beforeAll(() => {
        return new Promise<void>(resolve => {
          server = createServer((req: IncomingMessage, res: ServerResponse) => {
            requestCount += 1;
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
          }).listen(0, () => {
            addressInfo = server.address() as AddressInfo;
            resolve();
          });
        });
      });
      beforeEach(() => {
        requestCount = 0;
      });
      afterAll(async () => {
        // Bun's closeAllConnections can leave the listener already closed.
        if (!globalThis.Bun) {
          server.closeAllConnections?.();
        }
        await new Promise<void>((resolve, reject) => {
          server.close(err => {
            if (err && (err as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') {
              reject(err);
              return;
            }
            resolve();
          });
        });
      });
      for (const statusCode of redirectionStatusCodes) {
        it(`should follow ${statusCode} redirection`, async () => {
          const res = await fetchAPI.fetch(
            `http://localhost:${addressInfo.port}/status-${statusCode}`,
          );
          expect(res.status).toBe(200);
          expect(await res.text()).toBe('redirected');
          expect(requestCount).toBe(2);
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
          expect(requestCount).toBe(1);
        });
      }
    },
    { noUndici: Boolean(process.env.LEAK_TEST) },
  );
});
