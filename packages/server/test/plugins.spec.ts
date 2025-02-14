import { describe, expect, it } from '@jest/globals';
import { Request, Response } from '@whatwg-node/fetch';
import { createServerAdapter } from '@whatwg-node/server';

describe('Plugins', () => {
  it('should reflect updated response in subsequent plugins', async () => {
    let firstRes: Response | undefined;
    let secondRes: Response | undefined;
    const adapter = createServerAdapter<{}>(() => Response.json({ message: 'Hello, World!' }), {
      plugins: [
        {
          onResponse({ response, setResponse }) {
            firstRes = response;
            setResponse(Response.json({ message: 'Good bye!' }, { status: 418 }));
          },
        },
        {
          onResponse({ response }) {
            secondRes = response;
          },
        },
      ],
    });
    const request = new Request('http://localhost');
    const response = await adapter.fetch(request);
    expect(response.status).toBe(418);
    expect(await response.json()).toEqual({ message: 'Good bye!' });
    expect(firstRes?.status).toBe(200);
    expect(secondRes?.status).toBe(418);
  });
});
