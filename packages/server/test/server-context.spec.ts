import { runTestsForEachFetchImpl } from './test-fetch';

describe('Server Context', () => {
  runTestsForEachFetchImpl(
    (_, { createServerAdapter, fetchAPI: { Request, Response } }) => {
      it('should be passed to the handler', async () => {
        const exampleStaticCtx = { foo: 'bar' };
        const seenCtx = new Set();
        const adapter = createServerAdapter<typeof exampleStaticCtx>(function handler(_req, ctx) {
          seenCtx.add(ctx);
          ctx.foo = 'baz';
          return new Response('ok');
        });
        const res = await adapter(new Request('https://example.com'), exampleStaticCtx);
        expect(res.status).toBe(200);
        expect(seenCtx.size).toBe(1);
        expect(seenCtx.has(exampleStaticCtx)).toBe(false);
        expect(exampleStaticCtx.foo).toBe('bar');
        const res2 = await adapter(new Request('https://example.com'), exampleStaticCtx);
        expect(res2.status).toBe(200);
        expect(seenCtx.size).toBe(2);
        expect(seenCtx.has(exampleStaticCtx)).toBe(false);
        expect(exampleStaticCtx.foo).toBe('bar');
      });
      it('filters empty ctx', async () => {
        const adapter = createServerAdapter<any>(function handler(_req, ctx) {
          return Response.json(ctx);
        });
        const ctxParts: any[] = [undefined, undefined, { foo: 'bar' }, undefined, { bar: 'baz' }];
        const res = await adapter(new Request('https://example.com'), ...ctxParts);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ foo: 'bar', bar: 'baz' });
      });
    },
    { noLibCurl: true },
  );
});
