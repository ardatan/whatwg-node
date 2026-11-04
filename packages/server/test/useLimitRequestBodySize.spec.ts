import { describe, expect, it } from '@jest/globals';
import type { ServerAdapterPlugin } from '../src/plugins/types.js';
import { useErrorHandling } from '../src/plugins/useErrorHandling.js';
import {
  RequestBodyTooLargeError,
  useLimitRequestBodySize,
} from '../src/plugins/useLimitRequestBodySize.js';
import { runTestsForEachFetchImpl } from './test-fetch.js';

describe('useLimitRequestBodySize', () => {
  it('rejects non-finite or negative limits', () => {
    expect(() => useLimitRequestBodySize(Number.NaN)).toThrow(TypeError);
    expect(() => useLimitRequestBodySize(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => useLimitRequestBodySize(-1)).toThrow(TypeError);
  });

  runTestsForEachFetchImpl((_, { createServerAdapter, fetchAPI }) => {
    function createAdapter(limit: number) {
      return createServerAdapter(
        async request => {
          const body = await request.text();
          return fetchAPI.Response.json({ body });
        },
        {
          plugins: [
            useLimitRequestBodySize(limit),
            useErrorHandling((err: any) => {
              if (
                err instanceof RequestBodyTooLargeError ||
                err?.name === 'RequestBodyTooLargeError'
              ) {
                return fetchAPI.Response.json(
                  { error: err.message },
                  { status: err.status ?? 413 },
                );
              }
              return fetchAPI.Response.json(
                { error: String(err?.message ?? err) },
                { status: 500 },
              );
            }),
          ] as ServerAdapterPlugin[],
          fetchAPI,
        },
      );
    }

    it('rejects when Content-Length exceeds the limit', async () => {
      const adapter = createAdapter(10);
      const response = await adapter.fetch('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'this is longer than ten',
      });
      expect(response.status).toBe(413);
      const body = await response.text();
      expect(body).toMatch(/Request body too large/);
    });

    it('rejects invalid Content-Length values', async () => {
      const adapter = createAdapter(1000);
      const response = await adapter.fetch(
        new fetchAPI.Request('http://localhost/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Content-Length': '1, 2',
          },
          body: 'ok',
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Content-Length header is invalid.');
    });

    it('rejects a streamed body once it exceeds the limit', async () => {
      const adapter = createAdapter(10);
      const encoder = new TextEncoder();
      const stream = new fetchAPI.ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('this is longer than ten'));
          controller.close();
        },
      });
      const response = await adapter.fetch(
        new fetchAPI.Request('http://localhost/test', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: stream,
          // @ts-expect-error duplex is required for streamed bodies
          duplex: 'half',
        }),
      );
      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toEqual({ error: 'Request body too large' });
    });

    it('allows bodies within the limit', async () => {
      const adapter = createAdapter(1000);
      const response = await adapter.fetch('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'hello',
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ body: 'hello' });
    });

    it('preserves Request identity when Content-Length is within the limit', async () => {
      let requestBeforeLimit: Request | undefined;
      let requestAfterLimit: Request | undefined;
      const adapter = createServerAdapter(
        async request => {
          const body = await request.text();
          return fetchAPI.Response.json({ body, same: request === requestAfterLimit });
        },
        {
          plugins: [
            {
              onRequest({ request }) {
                requestBeforeLimit = request;
              },
            },
            useLimitRequestBodySize(1000),
            {
              onRequest({ request }) {
                requestAfterLimit = request;
              },
            },
          ] as ServerAdapterPlugin[],
          fetchAPI,
        },
      );

      const response = await adapter.fetch(
        new fetchAPI.Request('http://localhost/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Content-Length': '5',
          },
          body: 'hello',
        }),
      );
      expect(response.status).toBe(200);
      expect(requestBeforeLimit).toBe(requestAfterLimit);
      await expect(response.json()).resolves.toEqual({ body: 'hello', same: true });
    });

    it('replaces Request only when Content-Length is missing and the body must be counted', async () => {
      let requestBeforeLimit: Request | undefined;
      let requestAfterLimit: Request | undefined;
      const adapter = createServerAdapter(
        async request => fetchAPI.Response.json({ body: await request.text() }),
        {
          plugins: [
            {
              onRequest({ request }) {
                requestBeforeLimit = request;
              },
            },
            useLimitRequestBodySize(1000),
            {
              onRequest({ request }) {
                requestAfterLimit = request;
              },
            },
          ] as ServerAdapterPlugin[],
          fetchAPI,
        },
      );

      const encoder = new TextEncoder();
      const stream = new fetchAPI.ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('hello'));
          controller.close();
        },
      });
      const response = await adapter.fetch(
        new fetchAPI.Request('http://localhost/test', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: stream,
          // @ts-expect-error duplex is required for streamed bodies
          duplex: 'half',
        }),
      );
      expect(response.status).toBe(200);
      expect(requestBeforeLimit).toBeDefined();
      expect(requestAfterLimit).toBeDefined();
      expect(requestAfterLimit).not.toBe(requestBeforeLimit);
      await expect(response.json()).resolves.toEqual({ body: 'hello' });
    });

    it('rejects when a short Content-Length cannot cover the body (ponyfill)', async () => {
      // Ponyfill Request enforces Content-Length while reading; native undici may not
      // on in-process adapter.fetch Requests, so this case is ponyfill-only.
      if (fetchAPI.Request === globalThis.Request) {
        return;
      }
      const adapter = createServerAdapter(
        async request => fetchAPI.Response.json({ body: await request.text() }),
        {
          plugins: [
            useLimitRequestBodySize(1000),
            useErrorHandling((err: any) => {
              if (err?.name === 'ContentLengthMismatchError') {
                return fetchAPI.Response.json({ error: err.message }, { status: 400 });
              }
              return fetchAPI.Response.json(
                { error: String(err?.message ?? err) },
                { status: 500 },
              );
            }),
          ] as ServerAdapterPlugin[],
          fetchAPI,
        },
      );

      const encoder = new TextEncoder();
      const stream = new fetchAPI.ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('this is longer than five'));
          controller.close();
        },
      });
      const response = await adapter.fetch(
        new fetchAPI.Request('http://localhost/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Content-Length': '5',
          },
          body: stream,
          // @ts-expect-error duplex is required for streamed bodies
          duplex: 'half',
        }),
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Body length does not match content-length header',
      });
    });

    it('byte-counts decoded bodies when Content-Encoding is present', async () => {
      const { gzipSync } = await import('node:zlib');
      const { useContentEncoding } = await import('../src/plugins/useContentEncoding.js');
      const plain = 'x'.repeat(50_000);
      const compressed = gzipSync(plain);
      expect(compressed.byteLength).toBeLessThan(1000);

      const adapter = createServerAdapter(
        async request => {
          const body = await request.text();
          return fetchAPI.Response.json({ length: body.length });
        },
        {
          // Encoding must run before the limit plugin so we count decoded bytes.
          plugins: [
            useContentEncoding(),
            useLimitRequestBodySize(1000),
            useErrorHandling((err: any) => {
              if (
                err instanceof RequestBodyTooLargeError ||
                err?.name === 'RequestBodyTooLargeError'
              ) {
                return fetchAPI.Response.json(
                  { error: err.message },
                  { status: err.status ?? 413 },
                );
              }
              return fetchAPI.Response.json(
                { error: String(err?.message ?? err) },
                { status: 500 },
              );
            }),
          ] as ServerAdapterPlugin[],
          fetchAPI,
        },
      );

      const tooLarge = await adapter.fetch(
        new fetchAPI.Request('http://localhost/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Content-Encoding': 'gzip',
            'Content-Length': String(compressed.byteLength),
          },
          body: compressed,
        }),
      );
      expect(tooLarge.status).toBe(413);

      const small = gzipSync('hello');
      const ok = await adapter.fetch(
        new fetchAPI.Request('http://localhost/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Content-Encoding': 'gzip',
            'Content-Length': String(small.byteLength),
          },
          body: small,
        }),
      );
      expect(ok.status).toBe(200);
      await expect(ok.json()).resolves.toEqual({ length: 5 });
    });

    it('uses responseFromError for early Content-Length rejects', async () => {
      const adapter = createServerAdapter(() => fetchAPI.Response.json({ ok: true }), {
        plugins: [
          useLimitRequestBodySize(10, {
            responseFromError: (error, api) =>
              api.Response.json(
                {
                  errors: [
                    {
                      message: error.message,
                      extensions: { http: { status: error.status } },
                    },
                  ],
                },
                { status: error.status },
              ),
          }),
        ],
        fetchAPI,
      });
      const response = await adapter.fetch(
        new fetchAPI.Request('http://localhost/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Content-Length': '100',
          },
          body: 'short',
        }),
      );
      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toEqual({
        errors: [
          {
            message: 'Request body too large',
            extensions: { http: { status: 413 } },
          },
        ],
      });
    });

    it('accepts a native Request subclass and still limits its body', async () => {
      class SubRequest extends Request {}
      const adapter = createAdapter(64);
      const ok = await adapter.fetch(
        new SubRequest('http://localhost/test', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: 'hello',
        }),
      );
      expect(ok.status).toBe(200);
      await expect(ok.json()).resolves.toEqual({ body: 'hello' });

      const proxied = new Proxy(
        new SubRequest('http://localhost/test', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: 'hello',
        }),
        {
          get(target, prop) {
            // Next's proxy reads slots with the target as receiver, not the proxy.
            const value = Reflect.get(target, prop, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        },
      );
      const proxiedResponse = await adapter.fetch(proxied);
      expect(proxiedResponse.status).toBe(200);
      await expect(proxiedResponse.json()).resolves.toEqual({ body: 'hello' });

      const encoder = new globalThis.TextEncoder();
      const stream = new globalThis.ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('x'.repeat(80)));
          controller.close();
        },
      });
      const tooBig = await adapter.fetch(
        new SubRequest('http://localhost/test', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: stream,
          // @ts-expect-error duplex is required for streamed bodies
          duplex: 'half',
        }),
      );
      expect(tooBig.status).toBe(413);
      await expect(tooBig.json()).resolves.toEqual({ error: 'Request body too large' });
    });

    const itPonyfillOnly = fetchAPI.Request === globalThis.Request ? it.skip : it;
    itPonyfillOnly('keeps a ponyfill Request subclass on the ponyfill Fetch API', async () => {
      class SubPonyfillRequest extends fetchAPI.Request {}
      const adapter = createAdapter(10);
      const response = await adapter.fetch(
        new SubPonyfillRequest('http://localhost/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Content-Length': '100',
          },
          body: 'short',
        }),
      );
      expect(response.status).toBe(413);
      expect(response.constructor).toBe(fetchAPI.Response);
    });

    it('works with a native Request and ReadableStream', async () => {
      const adapter = createAdapter(10);
      const encoder = new globalThis.TextEncoder();
      const stream = new globalThis.ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('this is longer than ten'));
          controller.close();
        },
      });
      const response = await adapter.fetch(
        new globalThis.Request('http://localhost/test', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: stream,
          // @ts-expect-error duplex is required for streamed bodies
          duplex: 'half',
        }),
      );
      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toEqual({ error: 'Request body too large' });
    });
  });
});
