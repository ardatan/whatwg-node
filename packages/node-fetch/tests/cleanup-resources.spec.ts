import { beforeEach, describe, expect, it } from '@jest/globals';
import { runTestsForEachFetchImpl } from '../../server/test/test-fetch';
import { runTestsForEachServerImpl } from '../../server/test/test-server';

const describeIf = (condition: boolean) => (condition ? describe : describe.skip);

function isExternalConnectivityError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (
    error.name === 'AbortError' ||
    error.name === 'TimeoutError' ||
    error.name === 'FetchError' ||
    error.name === 'ConnectTimeoutError' ||
    error.name === 'HeadersTimeoutError' ||
    error.name === 'BodyTimeoutError'
  ) {
    return true;
  }
  const code = (error as NodeJS.ErrnoException).code;
  return (
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_HEADERS_TIMEOUT' ||
    code === 'UND_ERR_BODY_TIMEOUT' ||
    code === 'UND_ERR_SOCKET'
  );
}

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
      it('https - should free resources when body is not consumed', async () => {
        try {
          const response = await fetch('https://httpbin.org/get', {
            signal: AbortSignal.timeout(3000),
          });
          if (response.status !== 503) {
            expect(response.ok).toBe(true);
          }
        } catch (error) {
          // Soft-skip timeouts and common connectivity failures (DNS / refuse / reset / undici).
          if (isExternalConnectivityError(error)) {
            console.warn('External HTTPS unavailable, skipping test:', error);
          } else {
            throw error;
          }
        }
      });
    });
  });
});
