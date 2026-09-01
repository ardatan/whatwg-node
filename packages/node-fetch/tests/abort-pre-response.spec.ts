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

  it('rejects manual abort with AbortError', async () => {
    const controller = new AbortController();
    const fetchPromise = fetchNodeHttp(
      new PonyfillRequest(baseUrl + '/delay/3', {
        signal: controller.signal,
      }),
    );
    controller.abort();
    try {
      await fetchPromise;
      throw new Error('Expected fetch to reject');
    } catch (error) {
      expect(error).toMatchObject({ name: 'AbortError' });
    }
  });

  it('does not leak active requests when aborting before response', async () => {
    try {
      await fetchNodeHttp(
        new PonyfillRequest(baseUrl + '/delay/3', {
          signal: AbortSignal.timeout(50),
        }),
      );
    } catch {
      // expected
    }
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(
      (process as NodeJS.Process & { _getActiveRequests(): unknown[] })._getActiveRequests().length,
    ).toBe(0);
  });
});
