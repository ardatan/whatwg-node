import { Response } from '@whatwg-node/fetch';
import { createServerAdapter } from '@whatwg-node/server';

export const createTestServerAdapter = <TServerContext = {}>() =>
  createServerAdapter<TServerContext>(async req =>
    Response.json({
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      reqText: req.method === 'POST' ? await req.text() : '',
    }),
  );
