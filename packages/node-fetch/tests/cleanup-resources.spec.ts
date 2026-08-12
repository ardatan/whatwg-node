import { createServer as createHttpsServer, type Server as HttpsServer } from 'node:https';
import type { AddressInfo } from 'node:net';
import type { CertificateCreationResult } from 'pem';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { runTestsForEachFetchImpl } from '../../server/test/test-fetch';
import { runTestsForEachServerImpl } from '../../server/test/test-server';

const describeIf = (condition: boolean) => (condition ? describe : describe.skip);

describeIf(!globalThis.Deno)('Cleanup Resources', () => {
  runTestsForEachFetchImpl((_, { createServerAdapter, fetchAPI: { Response, fetch } }) => {
    describe('internal calls', () => {
      runTestsForEachServerImpl(testServer => {
        beforeEach(async () => {
          await testServer.addOnceHandler(
            createServerAdapter(() => Response.json({ test: 'test' })),
          );
        });
        it('should free resources when body is not consumed', async () => {
          const response = await fetch(testServer.url);
          expect(response.ok).toBe(true);
        });
      });
    });
    describe('external calls', () => {
      it('http - should free resources when body is not consumed', async () => {
        const baseUrl = process.env.CI ? 'http://localhost:8888' : 'https://httpbin.org';
        const response = await fetch(baseUrl + '/get');
        if (response.status !== 503) {
          expect(response.ok).toBe(true);
        }
      });
      describe('https', () => {
        let server: HttpsServer;
        let url: string;
        const previousRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

        beforeAll(async () => {
          const { createCertificate } = await import('pem');
          const keys = await new Promise<CertificateCreationResult>((resolve, reject) => {
            createCertificate(
              {
                selfSigned: true,
                days: 1,
              },
              (err, result) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(result);
                }
              },
            );
          });

          // Ephemeral self-signed cert; allow TLS for this describe only.
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

          server = createHttpsServer(
            {
              key: keys.serviceKey,
              cert: keys.certificate,
            },
            (_req, res) => {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ test: 'test' }));
            },
          );
          await new Promise<void>(resolve => {
            server.listen(0, '127.0.0.1', resolve);
          });
          const { port } = server.address() as AddressInfo;
          url = `https://127.0.0.1:${port}/get`;
        });

        afterAll(async () => {
          if (previousRejectUnauthorized == null) {
            delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
          } else {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousRejectUnauthorized;
          }
          await new Promise<void>((resolve, reject) => {
            server.close(err => (err ? reject(err) : resolve()));
          });
        });

        it('should free resources when body is not consumed', async () => {
          const response = await fetch(url);
          expect(response.ok).toBe(true);
        });
      });
    });
  });
});
