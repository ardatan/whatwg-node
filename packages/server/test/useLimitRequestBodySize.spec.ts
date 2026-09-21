import { describe, expect, it } from '@jest/globals';
import { handleMaybePromise } from '@whatwg-node/promise-helpers';
import { useErrorHandling } from '../src/plugins/useErrorHandling.js';
import {
  RequestBodyTooLargeError,
  useLimitRequestBodySize,
} from '../src/plugins/useLimitRequestBodySize.js';
import { runTestsForEachFetchImpl } from './test-fetch.js';

describe('useLimitRequestBodySize', () => {
  runTestsForEachFetchImpl((_, { createServerAdapter, fetchAPI }) => {
    function createAdapter(limit: number) {
      return createServerAdapter(
        request =>
          handleMaybePromise(
            () => request.text(),
            body => fetchAPI.Response.json({ body }),
          ),
        {
          plugins: [
            useLimitRequestBodySize(limit),
            useErrorHandling((err, _req, _ctx, api) => {
              if (
                err instanceof RequestBodyTooLargeError ||
                err?.name === 'RequestBodyTooLargeError'
              ) {
                return api.Response.json({ error: err.message }, { status: err.status ?? 413 });
              }
              return api.Response.json({ error: String(err?.message ?? err) }, { status: 500 });
            }),
          ],
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
