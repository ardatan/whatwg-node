import { createServerAdapter } from "../src/createServerAdapter"

describe('Server Context', () => {
    it('should be passed to the handler', async () => {
        const exampleStaticCtx = { foo: 'bar' };
        const seenCtx = new Set();
        const adapter = createServerAdapter(function handler(req: Request, ctx: any) {
            seenCtx.add(ctx);
            ctx.foo = 'baz';
            return new Response('ok');
        })
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
    })
})