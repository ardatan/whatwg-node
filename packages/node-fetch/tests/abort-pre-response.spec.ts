import { describe, expect, it } from '@jest/globals';
import { fetchNodeHttp } from '../src/fetchNodeHttp.js';
import { PonyfillRequest } from '../src/Request.js';

describe('fetchNodeHttp abort', () => {
  const baseUrl = process.env.CI ? 'http://localhost:8888' : 'https://httpbin.org';

  it('rejects AbortSignal.timeout with TimeoutError', async () => {
    await expect(
      fetchNodeHttp(
        new PonyfillRequest(baseUrl + '/delay/3', {
          signal: AbortSignal.timeout(50),
        }),
      ),
    ).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });
});
