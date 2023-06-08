import { Response } from '@whatwg-node/fetch';
import { createServerAdapter } from '@whatwg-node/server';

export function createTestServerAdapter<TServerContext = {}>() {
  return createServerAdapter<TServerContext>(async req => {
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return Response.json({
      url: req.url,
      method: req.method,
      headers,
      reqText: req.method === 'POST' ? await req.text() : '',
    });
  });
}
