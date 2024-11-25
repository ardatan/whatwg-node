import { runTestsForEachFetchImpl } from '../../server/test/test-fetch';
import { runTestsForEachServerImpl } from '../../server/test/test-server';

describe('Cleanup Resources', () => {
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
        const response = await fetch('http://google.com');
        expect(response.ok).toBe(true);
      });
      it('https - should free resources when body is not consumed', async () => {
        const response = await fetch('https://google.com');
        expect(response.ok).toBe(true);
      });
    });
  });
});
