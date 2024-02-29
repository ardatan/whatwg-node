import { Response } from '@whatwg-node/node-fetch';
import { createServerAdapter } from '@whatwg-node/server';
import { runTestsForEachFetchImpl } from '../../server/test/test-fetch';
import { runTestsForEachServerImpl } from '../../server/test/test-server';
import { fetchPonyfill } from '../src/fetch';

describe('Garbage Collection', () => {
  runTestsForEachFetchImpl(() => {
    describe('internal calls', () => {
      runTestsForEachServerImpl(testServer => {
        beforeEach(() => {
          testServer.addOnceHandler(createServerAdapter(() => Response.json({ test: 'test' })));
        });
        it('should free resources when body is not consumed', async () => {
          const response = await fetchPonyfill(testServer.url);
          expect(response.status).toBe(200);
        });
      });
    });
    describe('external calls', () => {
      it('should free resources when body is not consumed', async () => {
        const response = await fetchPonyfill('http://google.com');
        expect(response.status).toBe(200);
      });
    });
  });
});
