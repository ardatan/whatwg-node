import { beforeEach, describe, expect, it } from '@jest/globals';
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
      const httpBaseUrl = process.env.CI ? 'http://localhost:8888' : 'http://httpbin.org';
      const externalBaseUrlForHttpsTest = process.env.CI
        ? 'http://localhost:8888'
        : 'https://httpbin.org';
      it('http - should free resources when body is not consumed', async () => {
        const response = await fetch(httpBaseUrl + '/get');
        expect(response.ok).toBe(true);
      });
      it('https (or CI fallback) - should free resources when body is not consumed', async () => {
        const response = await fetch(externalBaseUrlForHttpsTest + '/get');
        expect(response.ok).toBe(true);
      });
    });
  });
});
