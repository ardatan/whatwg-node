import { describe, expect, it, jest } from '@jest/globals';
import { Request, Response } from '@whatwg-node/fetch';
import { createServerAdapter, OnResponseEventPayload } from '@whatwg-node/server';

describe('Plugins', () => {
  it('should reflect updated response in subsequent plugins', async () => {
    const firstOnResponse = jest.fn((payload: OnResponseEventPayload<{}>) => {
      payload.setResponse(Response.json({ message: 'Good bye!' }, { status: 418 }));
    });
    const secondOnResponse = jest.fn((_payload: OnResponseEventPayload<{}>) => {});
    const adapter = createServerAdapter<{}>(() => Response.json({ message: 'Hello, World!' }), {
      plugins: [{ onResponse: firstOnResponse }, { onResponse: secondOnResponse }],
    });
    const request = new Request('http://localhost');
    const response = await adapter.fetch(request);
    expect(response.status).toBe(418);
    expect(await response.json()).toEqual({ message: 'Good bye!' });
    expect(firstOnResponse.mock.calls[0][0].response.status).toBe(200);
    expect(secondOnResponse.mock.calls[0][0].response.status).toBe(418);
  });
});
