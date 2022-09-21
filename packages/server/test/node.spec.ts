import { createServerAdapter } from '@whatwg-node/server';
import { fetch, Response } from '@whatwg-node/fetch';
import { startTServer } from './tserver';

describe('Node Specific Cases', () => {
  it('should handle empty responses', async () => {
    const serverAdapter = createServerAdapter(() => {
      return undefined as any;
    });
    const { url } = startTServer(serverAdapter);
    const response = await fetch(url);
    await response.text();
    expect(response.status).toBe(404);
  });

  it('should handle waitUntil properly', async () => {
    let flag = false;
    const serverAdapter = createServerAdapter((_request, { waitUntil }) => {
      waitUntil(
        Promise.resolve().then(() => {
          flag = true;
        })
      );
      return Promise.resolve(
        new Response(null, {
          status: 204,
        })
      );
    });
    const { url } = startTServer(serverAdapter);
    const response$ = fetch(url);
    expect(flag).toBe(false);
    const response = await response$;
    await response.text();
    expect(flag).toBe(true);
  });
});
