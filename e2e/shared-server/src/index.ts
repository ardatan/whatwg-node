import { createServerAdapter, getHeadersObj } from '@whatwg-node/server';
import { Response } from '@whatwg-node/fetch';

export function createTestServerAdapter<TServerContext = {}>() {
  return createServerAdapter<TServerContext>(async req => {
    return Response.json({
      url: req.url,
      method: req.method,
      headers: getHeadersObj(req.headers),
      reqText: await req.text(),
    })
  })
}
