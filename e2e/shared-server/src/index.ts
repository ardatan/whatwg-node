import { Response } from '@whatwg-node/fetch';
import { createServerAdapter, getHeadersObj } from '@whatwg-node/server';

export function createTestServerAdapter<TServerContext = {}>() {
  return createServerAdapter<TServerContext>(async req => {
    return Response.json({
      url: req.url,
      method: req.method,
      headers: getHeadersObj(req.headers),
      reqText: req.method === 'POST' ? await req.text() : '',
    });
  });
}
