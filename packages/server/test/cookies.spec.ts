import { describe, expect, it } from '@jest/globals';
import { runTestsForEachFetchImpl } from './test-fetch';
import { runTestsForEachServerImpl } from './test-server';

describe('Cookies', () => {
  runTestsForEachFetchImpl((_fetchImpl, { createServerAdapter, fetchAPI }) => {
    runTestsForEachServerImpl(serverImpl => {
      const skipIf = (condition: boolean) => (condition ? it.skip : it);
      // Hapi has some issues with multiple Set-Cookie headers
      skipIf(serverImpl.name === 'hapi')('should handle cookies correctly', async () => {
        serverImpl.addOnceHandler(
          createServerAdapter(() => {
            const response = new fetchAPI.Response('OK');
            response.headers.append('set-cookie', 'name=value0; SameSite=None; Secure');
            response.headers.append('set-cookie', 'name=value1; SameSite=Strict; Secure');
            return response;
          }),
        );
        const response = await fetchAPI.fetch(serverImpl.url);
        const cookies = response.headers.getSetCookie();
        expect(cookies).toEqual([
          'name=value0; SameSite=None; Secure',
          'name=value1; SameSite=Strict; Secure',
        ]);
        const resBody = await response.text();
        expect(resBody).toBe('OK');
      });
    });
  });
});
