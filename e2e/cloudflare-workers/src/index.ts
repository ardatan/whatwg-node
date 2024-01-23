import { createServerAdapter, type FetchEvent } from '@whatwg-node/server';

const app = createServerAdapter<FetchEvent>(async (request, ctx) =>
  Response.json({
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    reqText: request.method === 'POST' ? await request.text() : '',
    reqExistsInCtx: ctx.request === request,
  }),
);

self.addEventListener('fetch', app);
