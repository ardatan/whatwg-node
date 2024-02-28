import { Response } from '@whatwg-node/node-fetch';
import { createServerAdapter } from '@whatwg-node/server';
import { runTestsForEachServerImpl } from '../../server/test/test-server';
import { fetchNodeHttp } from '../src/fetchNodeHttp';
import { PonyfillRequest } from '../src/Request';

describe('Garbage Collection', () => {
  runTestsForEachServerImpl(testServer => {
    beforeEach(() => {
      testServer.addOnceHandler(createServerAdapter(() => Response.json({ test: 'test' })));
    });
    it('should free resources when body is not consumed', async () => {
      const response = await fetchNodeHttp(new PonyfillRequest(testServer.url));
      expect(response.status).toBe(200);
    });
  });
});
